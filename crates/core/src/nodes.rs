//! Pairing records and signal decisions survive instance deletion and restart.
use crate::{AppData, AppResult, Task};
use chrono::{Local, NaiveDateTime, TimeZone};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Verdict {
    Success,
    Failure,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SignalKind {
    Success,
    Failure,
    Check,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Direction {
    Head,
    Tail,
}
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CompletionCondition {
    #[default]
    Always,
    Completed,
    Incomplete,
}
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BlockRule {
    #[default]
    Never,
    Always,
    Unpaired,
    UnfinishedTasks,
    Incomplete,
    Completed,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SignalSpec {
    pub kind: SignalKind,
    pub direction: Direction,
    pub at: String,
    #[serde(default)]
    pub condition: CompletionCondition,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NodeSpec {
    pub id: String,
    pub name: String,
    pub start: String,
    pub end: String,
    #[serde(default = "default_required")]
    pub required_tasks: u32,
    #[serde(default)]
    pub confirmation_required: bool,
    #[serde(default)]
    pub signal: Option<SignalSpec>,
    #[serde(default)]
    pub block_success: BlockRule,
    #[serde(default)]
    pub block_failure: BlockRule,
}
fn default_required() -> u32 {
    1
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Decision {
    pub verdict: Verdict,
    pub at: i64,
    pub signal_id: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Node {
    pub spec: NodeSpec,
    #[serde(default)]
    pub confirmed: bool,
    #[serde(default)]
    pub emitted: bool,
    #[serde(default)]
    pub result: Option<Decision>,
}
impl Node {
    pub fn new(spec: NodeSpec) -> Self {
        Self {
            spec,
            confirmed: false,
            emitted: false,
            result: None,
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Binding {
    pub task_id: String,
    pub goal_id: String,
    pub node_id: String,
    pub completed: bool,
    pub bound_at: i64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Delivery {
    pub block_rule: BlockRule,
    pub node_id: String,
    pub blocked: bool,
    pub before: Option<Verdict>,
    pub after: Option<Verdict>,
    pub paired_count: usize,
    pub completed_count: usize,
    pub completed: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SignalEvent {
    pub id: String,
    pub goal_id: String,
    pub source_node_id: String,
    pub kind: SignalKind,
    pub direction: Direction,
    pub trigger_at: String,
    pub emitted_at: i64,
    pub deliveries: Vec<Delivery>,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeProgress {
    pub goal_id: String,
    pub node_id: String,
    pub paired_count: usize,
    pub completed_count: usize,
    pub all_tasks_completed: bool,
    pub completed: bool,
}
pub fn timestamp(value: &str) -> AppResult<i64> {
    if value.len() != 16 {
        return Err("节点时间需为 YYYY-MM-DDTHH:MM".into());
    }
    let date =
        NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M").map_err(|_| "无效的节点时间")?;
    Local
        .from_local_datetime(&date)
        .earliest()
        .map(|v| v.timestamp())
        .ok_or("该本地时间不存在".into())
}
fn execution_time(task: &Task) -> Option<String> {
    task.due_date.as_ref().map(|date| {
        format!(
            "{date}T{}",
            task.reminder_time.as_deref().unwrap_or("00:00")
        )
    })
}
impl AppData {
    pub fn task_node(&self, task: &Task) -> Option<&Node> {
        let goal = self
            .goals
            .iter()
            .find(|g| Some(&g.id) == task.goal_id.as_ref())?;
        if let Some(nid) = &task.node_id {
            return goal.nodes.iter().find(|n| &n.spec.id == nid);
        }
        let time = execution_time(task)?;
        goal.nodes
            .iter()
            .find(|n| n.spec.start <= time && time < n.spec.end)
    }
    pub fn node_progress(&self, goal_id: &str, node: &Node) -> NodeProgress {
        let bindings: Vec<_> = self
            .node_bindings
            .iter()
            .filter(|b| b.goal_id == goal_id && b.node_id == node.spec.id)
            .collect();
        let paired_count = bindings.len();
        let completed_count = bindings.iter().filter(|b| b.completed).count();
        let all_tasks_completed = paired_count > 0 && paired_count == completed_count;
        NodeProgress {
            goal_id: goal_id.into(),
            node_id: node.spec.id.clone(),
            paired_count,
            completed_count,
            all_tasks_completed,
            completed: all_tasks_completed
                && paired_count >= node.spec.required_tasks as usize
                && (!node.spec.confirmation_required || node.confirmed),
        }
    }
    pub fn all_node_progress(&self) -> Vec<NodeProgress> {
        self.goals
            .iter()
            .flat_map(|g| g.nodes.iter().map(|n| self.node_progress(&g.id, n)))
            .collect()
    }
    pub(crate) fn ensure_task_unsettled(&self, task_id: &str) -> AppResult<()> {
        let node = self
            .tasks
            .iter()
            .find(|t| t.id == task_id)
            .and_then(|t| self.task_node(t));
        if node.is_some_and(|n| n.result.is_some()) {
            return Err("节点已裁定，实例已报废，不能修改或重新执行".into());
        }
        Ok(())
    }
    pub(crate) fn release_binding(&mut self, task_id: &str) {
        self.node_bindings.retain(|b| b.task_id != task_id);
    }
    pub(crate) fn save_goal(
        &mut self,
        gid: Option<String>,
        name: String,
        specs: Vec<NodeSpec>,
    ) -> AppResult<()> {
        let name = name.trim().to_string();
        if let Some(gid) = gid {
            let index = self
                .goals
                .iter()
                .position(|g| g.id == gid)
                .ok_or("任务组不存在")?;
            let old = &self.goals[index];
            for node in &old.nodes {
                let updated = specs.iter().find(|n| n.id == node.spec.id);
                if updated.is_none()
                    && (node.result.is_some()
                        || node.emitted
                        || self
                            .node_bindings
                            .iter()
                            .any(|b| b.goal_id == gid && b.node_id == node.spec.id))
                {
                    return Err("已配对、已发信号或已裁定的节点不能删除".into());
                }
                if let Some(updated) = updated {
                    let mut compare = updated.clone();
                    compare.name = node.spec.name.clone();
                    if node.result.is_some() && compare != node.spec {
                        return Err("已裁定节点只能改名，不能修改规则或范围".into());
                    }
                    if node.emitted && updated.signal != node.spec.signal {
                        return Err("已发出的信号不能改写；请创建新节点".into());
                    }
                }
            }
            let nodes = specs
                .into_iter()
                .map(|spec| {
                    if let Some(old) = old.nodes.iter().find(|n| n.spec.id == spec.id) {
                        let mut node = old.clone();
                        node.spec = spec;
                        node
                    } else {
                        Node::new(spec)
                    }
                })
                .collect();
            self.goals[index].name = name;
            self.goals[index].nodes = nodes;
        } else {
            self.goals.push(crate::Goal {
                id: crate::id(),
                name,
                nodes: specs.into_iter().map(Node::new).collect(),
            });
        }
        Ok(())
    }
    pub(crate) fn confirm_node(
        &mut self,
        goal_id: &str,
        node_id: &str,
        confirmed: bool,
    ) -> AppResult<()> {
        let node = self
            .goals
            .iter_mut()
            .find(|g| g.id == goal_id)
            .and_then(|g| g.nodes.iter_mut().find(|n| n.spec.id == node_id))
            .ok_or("节点不存在")?;
        if node.result.is_some() {
            return Err("已有成功或失败标志不可修改".into());
        }
        if !node.spec.confirmation_required {
            return Err("此节点由配对任务自动判断完成".into());
        }
        node.confirmed = confirmed;
        Ok(())
    }
    pub(crate) fn bind_nodes(&mut self, at: i64) -> bool {
        let mut changed = false;
        let mut bindings: HashMap<String, usize> = self
            .node_bindings
            .iter()
            .enumerate()
            .map(|(i, b)| (b.task_id.clone(), i))
            .collect();
        for ti in 0..self.tasks.len() {
            let task = &self.tasks[ti];
            if let Some(bi) = bindings.get(&task.id).copied() {
                let binding = &mut self.node_bindings[bi];
                if binding.completed != task.completed {
                    binding.completed = task.completed;
                    changed = true;
                }
                if task.node_id.as_ref() != Some(&binding.node_id) {
                    self.tasks[ti].node_id = Some(binding.node_id.clone());
                    changed = true;
                }
            } else if let Some(node) = self.task_node(task) {
                let nid = node.spec.id.clone();
                let binding = Binding {
                    task_id: task.id.clone(),
                    goal_id: task.goal_id.clone().unwrap(),
                    node_id: nid.clone(),
                    completed: task.completed,
                    bound_at: at,
                };
                bindings.insert(task.id.clone(), self.node_bindings.len());
                self.node_bindings.push(binding);
                self.tasks[ti].node_id = Some(nid);
                changed = true;
            }
        }
        changed
    }
    pub(crate) fn tick_nodes(&mut self, at: i64) -> bool {
        let mut changed = self.bind_nodes(at);
        let mut candidates = Vec::new();
        for (gi, goal) in self.goals.iter().enumerate() {
            for (ni, node) in goal.nodes.iter().enumerate() {
                let Some(signal) = &node.spec.signal else {
                    continue;
                };
                let trigger = timestamp(&signal.at).unwrap();
                if trigger > at {
                    continue;
                }
                let progress = self.node_progress(&goal.id, node);
                let condition = match signal.condition {
                    CompletionCondition::Always => true,
                    CompletionCondition::Completed => progress.completed,
                    CompletionCondition::Incomplete => !progress.completed,
                };
                if !condition {
                    continue;
                }
                if !node.emitted
                    || (signal.kind == SignalKind::Check
                        && goal.nodes.iter().any(|n| {
                            n.result.is_none() && self.node_progress(&goal.id, n).completed
                        }))
                {
                    candidates.push((trigger, goal.id.clone(), node.spec.id.clone(), gi, ni));
                }
            }
        }
        candidates.sort();
        for (_, _, _, gi, ni) in candidates {
            // Earlier decisions can affect a later emitter's condition in this tick.
            let goal = &self.goals[gi];
            let node = &goal.nodes[ni];
            let signal = node.spec.signal.as_ref().unwrap();
            let complete = self.node_progress(&goal.id, node).completed;
            if (signal.condition == CompletionCondition::Completed && !complete)
                || (signal.condition == CompletionCondition::Incomplete && complete)
            {
                continue;
            }
            if self.signal_events.len() >= 200_000 {
                break;
            }
            self.emit_signal(gi, ni, at);
            changed = true;
        }
        changed
    }
    fn emit_signal(&mut self, gi: usize, source: usize, at: i64) {
        let goal = &self.goals[gi];
        let signal = goal.nodes[source].spec.signal.clone().unwrap();
        let gid = goal.id.clone();
        let source_id = goal.nodes[source].spec.id.clone();
        let indexes: Vec<usize> = match signal.direction {
            Direction::Head => (0..=source).rev().collect(),
            Direction::Tail => (source..goal.nodes.len()).collect(),
        };
        let event_id = crate::id();
        let mut deliveries = Vec::new();
        for index in indexes {
            let node = &self.goals[gi].nodes[index];
            let progress = self.node_progress(&gid, node);
            let rule = match signal.kind {
                SignalKind::Success => node.spec.block_success,
                SignalKind::Failure => node.spec.block_failure,
                SignalKind::Check => BlockRule::Never,
            };
            let blocked = index != source
                && node.spec.signal.is_some()
                && signal.kind != SignalKind::Check
                && match rule {
                    BlockRule::Never => false,
                    BlockRule::Always => true,
                    BlockRule::Unpaired => progress.paired_count == 0,
                    BlockRule::UnfinishedTasks => progress.paired_count > progress.completed_count,
                    BlockRule::Incomplete => !progress.completed,
                    BlockRule::Completed => progress.completed,
                };
            let before = node.result.as_ref().map(|r| r.verdict);
            let verdict = match signal.kind {
                SignalKind::Success => Some(Verdict::Success),
                SignalKind::Failure => Some(Verdict::Failure),
                SignalKind::Check => progress.completed.then_some(Verdict::Success),
            };
            let after = if blocked { before } else { before.or(verdict) };
            let node_id = node.spec.id.clone();
            if let (None, Some(verdict)) = (before, after) {
                self.goals[gi].nodes[index].result = Some(Decision {
                    verdict,
                    at,
                    signal_id: event_id.clone(),
                });
            }
            deliveries.push(Delivery {
                block_rule: rule,
                node_id,
                blocked,
                before,
                after,
                paired_count: progress.paired_count,
                completed_count: progress.completed_count,
                completed: progress.completed,
            });
            if blocked {
                break;
            }
        }
        self.goals[gi].nodes[source].emitted = true;
        self.signal_events.push(SignalEvent {
            id: event_id,
            goal_id: gid,
            source_node_id: source_id,
            kind: signal.kind,
            direction: signal.direction,
            trigger_at: signal.at,
            emitted_at: at,
            deliveries,
        });
    }
    pub(crate) fn protect_decisions(&self, next: &AppData) -> AppResult<()> {
        for goal in &self.goals {
            for node in goal
                .nodes
                .iter()
                .filter(|n| n.result.is_some() || n.emitted)
            {
                let restored = next
                    .goals
                    .iter()
                    .find(|g| g.id == goal.id)
                    .and_then(|g| g.nodes.iter().find(|n| n.spec.id == node.spec.id))
                    .ok_or("备份不能删除本机已有裁定或信号来源")?;
                if node.emitted && (!restored.emitted || restored.spec.signal != node.spec.signal) {
                    return Err("备份不能倒退或改写已发信号".into());
                }
                if node.result.is_some() {
                    let mut spec = restored.spec.clone();
                    spec.name = node.spec.name.clone();
                    if restored.result != node.result
                        || restored.confirmed != node.confirmed
                        || spec != node.spec
                    {
                        return Err("备份不能改写已裁定节点".into());
                    }
                    for binding in self
                        .node_bindings
                        .iter()
                        .filter(|b| b.goal_id == goal.id && b.node_id == node.spec.id)
                    {
                        if !next.node_bindings.iter().any(|b| {
                            b.task_id == binding.task_id
                                && b.goal_id == binding.goal_id
                                && b.node_id == binding.node_id
                                && b.completed == binding.completed
                                && b.bound_at == binding.bound_at
                        }) {
                            return Err("备份不能倒退已裁定节点的配对完成记录".into());
                        }
                    }
                }
            }
        }
        for event in &self.signal_events {
            let same = next
                .signal_events
                .iter()
                .find(|e| e.id == event.id)
                .is_some_and(|e| serde_json::to_value(e).ok() == serde_json::to_value(event).ok());
            if !same {
                return Err("备份不能删除或改写本机已有信号记录".into());
            }
        }
        Ok(())
    }
}
pub(crate) fn validate(data: &AppData) -> AppResult<()> {
    let mut global_nodes = HashSet::new();
    for goal in &data.goals {
        if goal.nodes.len() > 200 {
            return Err("每条主线最多 200 个节点".into());
        }
        let mut previous: Option<&str> = None;
        for (i, node) in goal.nodes.iter().enumerate() {
            let s = &node.spec;
            if s.id.is_empty()
                || !global_nodes.insert((&goal.id, &s.id))
                || s.name.trim().is_empty()
                || s.name.chars().count() > 80
                || s.required_tasks == 0
                || s.required_tasks > 50_000
            {
                return Err("无效的节点标识、名称或任务要求".into());
            }
            timestamp(&s.start)?;
            timestamp(&s.end)?;
            if s.start >= s.end || previous.is_some_and(|p| p > s.start.as_str()) {
                return Err("节点需按时间排列，区间不能重叠".into());
            }
            previous = Some(&s.end);
            if let Some(signal) = &s.signal {
                timestamp(&signal.at)?;
                if signal.kind == SignalKind::Check
                    && (i + 1 != goal.nodes.len()
                        || signal.direction != Direction::Head
                        || signal.condition != CompletionCondition::Always)
                {
                    return Err("检查信号只允许末节点向头无条件检查".into());
                }
            } else if node.emitted
                || s.block_success != BlockRule::Never
                || s.block_failure != BlockRule::Never
            {
                return Err("普通节点没有发信号或阻断权限".into());
            }
        }
    }
    if data.node_bindings.len() > 200_000 || data.signal_events.len() > 200_000 {
        return Err("节点记录数量超出限制".into());
    }
    let mut task_bindings = HashSet::new();
    for b in &data.node_bindings {
        if b.task_id.is_empty()
            || !task_bindings.insert(&b.task_id)
            || !global_nodes.contains(&(&b.goal_id, &b.node_id))
        {
            return Err("无效或重复的节点配对记录".into());
        }
        if let Some(task) = data.tasks.iter().find(|t| t.id == b.task_id) {
            if task.goal_id.as_ref() != Some(&b.goal_id)
                || task.node_id.as_ref() != Some(&b.node_id)
                || task.completed != b.completed
            {
                return Err("实例与节点配对记录不一致".into());
            }
        }
    }
    for task in &data.tasks {
        if let Some(node) = &task.node_id {
            if !data.node_bindings.iter().any(|b| {
                b.task_id == task.id
                    && &b.node_id == node
                    && task.goal_id.as_ref() == Some(&b.goal_id)
            }) {
                return Err("实例缺少对应节点配对记录".into());
            }
        }
    }
    let mut events = HashMap::new();
    for event in &data.signal_events {
        if event.id.is_empty()
            || events.insert(&event.id, event).is_some()
            || !global_nodes.contains(&(&event.goal_id, &event.source_node_id))
            || event.deliveries.is_empty()
            || event.deliveries.len() > 200
        {
            return Err("无效的节点信号记录".into());
        }
        let source = data
            .goals
            .iter()
            .find(|g| g.id == event.goal_id)
            .and_then(|g| g.nodes.iter().find(|n| n.spec.id == event.source_node_id))
            .ok_or("信号来源不存在")?;
        let signal = source
            .spec
            .signal
            .as_ref()
            .ok_or("来源节点没有发信号权限")?;
        if !source.emitted
            || signal.kind != event.kind
            || signal.direction != event.direction
            || signal.at != event.trigger_at
            || event.deliveries[0].node_id != event.source_node_id
            || event.deliveries[0].blocked
        {
            return Err("信号记录与来源规则不一致".into());
        }
        let source_done = event.deliveries[0].completed;
        if (signal.condition == CompletionCondition::Completed && !source_done)
            || (signal.condition == CompletionCondition::Incomplete && source_done)
        {
            return Err("信号发出时未满足自身完成条件".into());
        }
        timestamp(&event.trigger_at)?;
        let mut seen = HashSet::new();
        for d in &event.deliveries {
            let expected = if d.blocked {
                d.before
            } else {
                d.before.or(match event.kind {
                    SignalKind::Success => Some(Verdict::Success),
                    SignalKind::Failure => Some(Verdict::Failure),
                    SignalKind::Check => d.completed.then_some(Verdict::Success),
                })
            };
            if d.after != expected
                || (event.kind == SignalKind::Check && d.blocked)
                || (d.completed && (d.paired_count == 0 || d.completed_count != d.paired_count))
            {
                return Err("信号接收结果与裁定语义不一致".into());
            }

            if !seen.insert(&d.node_id)
                || !global_nodes.contains(&(&event.goal_id, &d.node_id))
                || d.completed_count > d.paired_count
                || (d.before.is_some() && d.after != d.before)
                || (d.blocked && d.after != d.before)
            {
                return Err("无效的信号接收记录".into());
            }
        }
    }
    for goal in &data.goals {
        for node in &goal.nodes {
            if let Some(result) = &node.result {
                let event = events
                    .get(&result.signal_id)
                    .ok_or("节点裁定缺少信号记录")?;
                if event.goal_id != goal.id
                    || event.emitted_at != result.at
                    || !event.deliveries.iter().any(|d| {
                        d.node_id == node.spec.id
                            && !d.blocked
                            && d.before.is_none()
                            && d.after == Some(result.verdict)
                    })
                {
                    return Err("节点裁定与信号记录不一致".into());
                }
            }
            if node.emitted
                && !data
                    .signal_events
                    .iter()
                    .any(|e| e.goal_id == goal.id && e.source_node_id == node.spec.id)
            {
                return Err("节点缺少已发信号记录".into());
            }
        }
    }
    Ok(())
}
