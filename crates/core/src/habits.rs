//! Habit groups carry jurisdiction, while templates own every printing rule.
use crate::{AppResult, Habit};
pub fn validate(habit: &Habit) -> AppResult<()> {
    if habit.name.trim().is_empty() || habit.name.chars().count() > 40 {
        return Err("习惯名称需为 1–40 个字符".into());
    }
    Ok(())
}
