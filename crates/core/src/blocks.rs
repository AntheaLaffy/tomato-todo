//! Out-of-plan occupied bands: lectures, labs and other fixed commitments.
//!
//! A block is descriptive. It never governs tasks, owns progress, or locks the
//! machine; it only tells the planner which parts of the week are already taken
//! and whether focus work may run in parallel with what happens there, so a
//! "水课" stops looking like free time.
use crate::{AppData, AppResult};
use chrono::{Datelike, NaiveDate, NaiveTime, Timelike};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

/// Whether a band demands undivided attention.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Attention {
    /// 需专心：落在这段时间里的专注安排与它真实冲突。
    #[default]
    Required,
    /// 水课：签到即可，课上可以并行写作业或戴耳机听课。
    Light,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Block {
    pub id: String,
    pub title: String,
    /// 1 = 周一 … 7 = 周日。
    pub days: Vec<u8>,
    /// 本机 HH:MM。`end` 不晚于 `start` 时表示跨午夜。
    pub start: String,
    pub end: String,
    #[serde(default)]
    pub attention: Attention,
    #[serde(default)]
    pub notes: String,
}

fn minute_of_day(value: &str) -> Option<u32> {
    if value.len() != 5 || value.as_bytes()[2] != b':' {
        return None;
    }
    NaiveTime::parse_from_str(value, "%H:%M")
        .ok()
        .map(|t| t.hour() * 60 + t.minute())
}

impl Block {
    /// The band as a `[start, end)` minute window measured from that date's
    /// midnight; `end` exceeds 1440 when the band crosses midnight. `None` when
    /// the band does not fall on this weekday.
    pub fn band(&self, date: NaiveDate) -> Option<(u32, u32)> {
        if !self
            .days
            .contains(&(date.weekday().number_from_monday() as u8))
        {
            return None;
        }
        let start = minute_of_day(&self.start)?;
        let end = minute_of_day(&self.end)?;
        let end = if end <= start { end + 1440 } else { end };
        Some((start, end))
    }

    /// Overlap in minutes between this band and a same-day `[start, end)` window.
    pub fn overlap_minutes(&self, date: NaiveDate, start: u32, end: u32) -> u32 {
        self.band(date)
            .map(|(band_start, band_end)| end.min(band_end).saturating_sub(start.max(band_start)))
            .unwrap_or(0)
    }

    pub fn validate(&self) -> AppResult<()> {
        if self.id.is_empty() {
            return Err("阻塞时段 ID 不能为空".into());
        }
        if self.title.trim().is_empty() || self.title.chars().count() > 40 {
            return Err("阻塞时段名称需为 1–40 个字符".into());
        }
        if minute_of_day(&self.start).is_none() || minute_of_day(&self.end).is_none() {
            return Err("阻塞时段需为有效的 HH:MM 时间".into());
        }
        if self.start == self.end {
            return Err("阻塞时段的开始与结束不能相同".into());
        }
        let unique: HashSet<_> = self.days.iter().collect();
        if self.days.is_empty()
            || self.days.len() > 7
            || unique.len() != self.days.len()
            || self.days.iter().any(|d| !(1..=7).contains(d))
        {
            return Err("请选择不重复的星期（周一为 1，周日为 7）".into());
        }
        if self.notes.chars().count() > 2_000 {
            return Err("阻塞时段备注过长".into());
        }
        Ok(())
    }
}

pub fn validate(data: &AppData) -> AppResult<()> {
    if data.blocks.len() > 60 {
        return Err("课表阻塞时段最多 60 项".into());
    }
    let mut ids = HashSet::new();
    for block in &data.blocks {
        block.validate()?;
        if !ids.insert(&block.id) {
            return Err("阻塞时段 ID 重复".into());
        }
    }
    Ok(())
}

/// Blocks covering `date`, sorted by start time then title.
pub fn on_date(blocks: &[Block], date: &str) -> Vec<Block> {
    let Ok(date) = NaiveDate::parse_from_str(date, "%Y-%m-%d") else {
        return vec![];
    };
    let mut list: Vec<Block> = blocks
        .iter()
        .filter(|b| b.band(date).is_some())
        .cloned()
        .collect();
    list.sort_by(|a, b| a.start.cmp(&b.start).then_with(|| a.title.cmp(&b.title)));
    list
}

/// Minutes already claimed by bands that demand attention on `date`. This is
/// occupancy evidence, not availability: overlapping bands would double count.
pub fn required_minutes(blocks: &[Block], date: &str) -> u32 {
    let Ok(date) = NaiveDate::parse_from_str(date, "%Y-%m-%d") else {
        return 0;
    };
    blocks
        .iter()
        .filter(|b| b.attention == Attention::Required)
        .filter_map(|b| b.band(date).map(|(start, end)| end - start))
        .sum()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn block(days: &[u8], start: &str, end: &str) -> Block {
        Block {
            id: "b1".into(),
            title: "大学英语Ⅰ".into(),
            days: days.to_vec(),
            start: start.into(),
            end: end.into(),
            attention: Attention::Light,
            notes: String::new(),
        }
    }

    fn date(value: &str) -> NaiveDate {
        NaiveDate::parse_from_str(value, "%Y-%m-%d").unwrap()
    }

    #[test]
    fn bands_match_weekdays_and_cross_midnight() {
        let monday = date("2026-10-12");
        assert_eq!(block(&[1], "09:55", "11:20").band(monday), Some((595, 680)));
        assert_eq!(block(&[2], "09:55", "11:20").band(monday), None);
        // 23:00–07:00 wraps: measured from Monday midnight it ends at 1860.
        assert_eq!(
            block(&[1], "23:00", "07:00").band(monday),
            Some((1380, 1860))
        );
    }

    #[test]
    fn overlap_counts_the_shared_minutes() {
        let monday = date("2026-10-12");
        let lecture = block(&[1], "09:55", "11:20");
        assert_eq!(lecture.overlap_minutes(monday, 600, 660), 60);
        assert_eq!(lecture.overlap_minutes(monday, 680, 700), 0);
    }

    #[test]
    fn validation_rejects_empty_days_and_equal_times() {
        assert!(block(&[], "09:00", "10:00").validate().is_err());
        assert!(block(&[1], "09:00", "09:00").validate().is_err());
        assert!(block(&[1, 8], "09:00", "10:00").validate().is_err());
        assert!(block(&[1], "09:00", "10:00").validate().is_ok());
    }

    #[test]
    fn required_minutes_only_counts_attention_bands() {
        let mut light = block(&[1], "09:55", "11:20");
        light.attention = Attention::Light;
        let mut required = block(&[1], "16:25", "18:35");
        required.attention = Attention::Required;
        let blocks = vec![light, required];
        assert_eq!(required_minutes(&blocks, "2026-10-12"), 130);
        assert_eq!(required_minutes(&blocks, "2026-10-13"), 0);
        assert_eq!(on_date(&blocks, "2026-10-12").len(), 2);
    }
}
