// 项目页的应试绑定：只改 syllabusId / pastPaperIds / mockPaperIds / examMode。
//
// 为什么放在项目页而不是应试教育页：候选项来自「这个项目已登记的资料」，用户在
// 项目页刚导入完，下一步自然就是指定哪份是考纲、哪份是真题。保存前重新读一次
// education.projects 档案再合并，避免把 directory / visionId / target / examDate
// 覆盖成默认值；examMode 的完整性校验留给 core，界面不提前绕过或粉饰错误。
import { h, useEffect, useState } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import {
  Btn,
  Card,
  Check,
  Chip,
  Field,
  SectionTitle,
  Select,
  Skeleton,
  notify,
} from "../shared/ui.js";
import { getSnapshot, refresh, tryDispatch } from "../shared/store.js";
import { getProjectResources } from "../shared/api.js";

registerCopy("project", {
  zh: {
    bindTitle: "应试绑定",
    bindHint:
      "从本项目已登记的资料里绑定考纲、真题与模拟题；保存只改这四项，目录、愿景、目标与考试日期保持不变。",
    bindExamMode: "应试模式",
    bindExamModeHint:
      "打开后 core 要求同时绑定愿景、目标、考纲、真题和模拟题；缺一项会拒绝保存并返回原因。",
    bindSyllabus: "考纲",
    bindPastPapers: "真题",
    bindMockPapers: "模拟题",
    bindSyllabusNone: "未绑定考纲",
    bindMissingOption: "{id}（未找到对应登记）",
    bindPickNone: "还没有可选的{kind}资料",
    bindPickHint: "先在上方导入或在应试教育页登记{kind}资料，再回来绑定。",
    bindSelectedCount: "已选 {n} 份",
    bindSave: "保存绑定",
    bindSaving: "正在保存…",
    bindSaved: "应试绑定已保存",
    bindMissingProfile: "这个项目还没有应试档案",
  },
  en: {
    bindTitle: "Exam binding",
    bindHint:
      "Bind a syllabus, past papers, and mock papers from this project's registered materials. Saving changes only these four fields; folder, vision, target, and exam date stay untouched.",
    bindExamMode: "Exam mode",
    bindExamModeHint:
      "When enabled, core requires a vision, target, syllabus, past papers, and mock papers together; if one is missing it refuses the save and returns the reason.",
    bindSyllabus: "Syllabus",
    bindPastPapers: "Past papers",
    bindMockPapers: "Mock papers",
    bindSyllabusNone: "No syllabus bound",
    bindMissingOption: "{id} (no matching entry)",
    bindPickNone: "No {kind} materials to choose from yet",
    bindPickHint:
      "Import materials above or register {kind} materials on the study page, then come back to bind them.",
    bindSelectedCount: "{n} selected",
    bindSave: "Save binding",
    bindSaving: "Saving…",
    bindSaved: "Exam binding saved",
    bindMissingProfile: "This project has no study profile yet",
  },
  ja: {
    bindTitle: "試験の紐付け",
    bindHint:
      "このプロジェクトに登録済みの資料からシラバス・過去問・模擬問題を選びます。保存で変わるのはこの4項目だけで、フォルダ・ビジョン・目標・試験日はそのままです。",
    bindExamMode: "試験モード",
    bindExamModeHint:
      "有効にすると core はビジョン・目標・シラバス・過去問・模擬問題のすべてを要求します。欠けている場合は保存を拒否し、理由を返します。",
    bindSyllabus: "シラバス",
    bindPastPapers: "過去問",
    bindMockPapers: "模擬問題",
    bindSyllabusNone: "シラバス未設定",
    bindMissingOption: "{id}（対応する登録なし）",
    bindPickNone: "選択できる{kind}資料がまだありません",
    bindPickHint:
      "上で資料を取り込むか、学習ページで{kind}資料を登録してから戻ってください。",
    bindSelectedCount: "{n} 件選択",
    bindSave: "紐付けを保存",
    bindSaving: "保存中…",
    bindSaved: "試験の紐付けを保存しました",
    bindMissingProfile: "このプロジェクトには学習プロフィールがありません",
  },
});

const RESOURCE_KINDS = ["syllabus", "pastPaper", "mockPaper"];
const PAGE_SIZE = 100;

function resourceKindLabel(kind) {
  return t(
    `education.resourceKind${kind.charAt(0).toUpperCase()}${kind.slice(1)}`,
  );
}

function errorText(error) {
  return (error && (error.userMessage || error.message)) || String(error);
}

function findStudyProfile(snapshot, projectId) {
  const list =
    snapshot &&
    snapshot.data &&
    snapshot.data.education &&
    snapshot.data.education.projects;
  if (!Array.isArray(list)) return null;
  return list.find((entry) => entry && entry.projectId === projectId) || null;
}

async function loadResourcesByKind(projectId, kind) {
  const all = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const page = await getProjectResources(projectId, {
      kind,
      offset,
      limit: PAGE_SIZE,
    });
    const list = Array.isArray(page && page.resources) ? page.resources : [];
    total = Number(page && page.total) || 0;
    if (list.length === 0) break;
    all.push(...list);
    offset += list.length;
  }
  return all;
}

function alertBox(message) {
  return h(
    "div",
    {
      role: "alert",
      style: {
        padding: "9px 12px",
        borderRadius: 10,
        background: "var(--tomato-brand-soft)",
        color: "var(--tomato-brand-deep)",
        fontSize: 12.5,
        lineHeight: 1.65,
        wordBreak: "break-word",
      },
    },
    message,
  );
}

function ResourceMultiPick({
  kind,
  items,
  selected,
  onChange,
  disabled,
  loading,
}) {
  const known = new Set(items.map((item) => item.id));
  // 候选列表还在读时，已绑定 ID 看起来都“缺失”；这时不要先闪一排未找到。
  const missing = loading ? [] : selected.filter((id) => !known.has(id));
  const toggle = (id) => {
    onChange(
      selected.includes(id)
        ? selected.filter((value) => value !== id)
        : [...selected, id],
    );
  };
  return h(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 6 } },
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        },
      },
      h(
        "span",
        {
          style: {
            fontSize: 12,
            fontWeight: 550,
            color: "var(--tomato-ink-2)",
          },
        },
        resourceKindLabel(kind),
      ),
      h(
        Chip,
        { tone: "neutral" },
        t("project.bindSelectedCount", { n: selected.length }),
      ),
    ),
    items.length === 0 && missing.length === 0
      ? h(
          "div",
          {
            style: {
              padding: "9px 11px",
              borderRadius: 9,
              background: "var(--tomato-surface-2)",
              fontSize: 11.5,
              color: "var(--tomato-ink-3)",
              lineHeight: 1.65,
            },
          },
          t("project.bindPickNone", { kind: resourceKindLabel(kind) }),
          " ",
          t("project.bindPickHint", { kind: resourceKindLabel(kind) }),
        )
      : h(
          "div",
          {
            className: "t-scroll",
            style: {
              maxHeight: 200,
              overflowY: "auto",
              border: "1px solid var(--tomato-line)",
              borderRadius: 10,
              padding: "4px 6px",
            },
          },
          items.map((item) =>
            h(
              "div",
              {
                key: item.id,
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 4px",
                  borderBottom: "1px solid var(--tomato-line)",
                },
              },
              h(Check, {
                checked: selected.includes(item.id),
                label: item.title || item.path,
                disabled,
                onChange: () => toggle(item.id),
              }),
              h(
                "div",
                {
                  style: {
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  },
                },
                h(
                  "span",
                  {
                    style: {
                      fontSize: 12.5,
                      color: "var(--tomato-ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    },
                  },
                  item.title || item.path,
                ),
                h(
                  "span",
                  {
                    className: "t-mono",
                    style: {
                      fontSize: 10.5,
                      color: "var(--tomato-ink-3)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    },
                  },
                  item.path,
                ),
              ),
            ),
          ),
          missing.map((id) =>
            h(
              "div",
              {
                key: `missing-${id}`,
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 4px",
                  color: "var(--tomato-ink-3)",
                },
              },
              h(Check, {
                checked: true,
                label: t("project.bindMissingOption", { id }),
                disabled,
                onChange: () => toggle(id),
              }),
              h(
                "span",
                { style: { fontSize: 12, wordBreak: "break-all" } },
                t("project.bindMissingOption", { id }),
              ),
            ),
          ),
        ),
  );
}

export function ProjectEducationBinding({ project, profile, reloadKey }) {
  const projectId = project.id;
  const [syllabus, setSyllabus] = useState("");
  const [past, setPast] = useState([]);
  const [mock, setMock] = useState([]);
  const [examMode, setExamMode] = useState(false);
  const [candidates, setCandidates] = useState({
    syllabus: [],
    pastPaper: [],
    mockPaper: [],
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const profileKey = profile
    ? [
        profile.syllabusId || "",
        (Array.isArray(profile.pastPaperIds) ? profile.pastPaperIds : []).join(
          "\u0001",
        ),
        (Array.isArray(profile.mockPaperIds) ? profile.mockPaperIds : []).join(
          "\u0001",
        ),
        profile.examMode === true ? "1" : "0",
      ].join("\u0002")
    : "";

  useEffect(() => {
    if (!profile) return;
    setSyllabus(profile.syllabusId || "");
    setPast(
      Array.isArray(profile.pastPaperIds) ? [...profile.pastPaperIds] : [],
    );
    setMock(
      Array.isArray(profile.mockPaperIds) ? [...profile.mockPaperIds] : [],
    );
    setExamMode(profile.examMode === true);
    setSaveError("");
  }, [projectId, profileKey]);

  useEffect(() => {
    if (!profile) return undefined;
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    Promise.all(
      RESOURCE_KINDS.map((kind) => loadResourcesByKind(projectId, kind)),
    )
      .then(([syllabusList, pastList, mockList]) => {
        if (cancelled) return;
        setCandidates({
          syllabus: syllabusList,
          pastPaper: pastList,
          mockPaper: mockList,
        });
      })
      .catch((error) => {
        if (!cancelled) setLoadError(errorText(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, profile !== null && profile !== undefined, reloadKey]);

  if (!profile) return null;

  const syllabusItems = candidates.syllabus;
  const syllabusOptions = [
    { value: "", label: t("project.bindSyllabusNone") },
    ...syllabusItems.map((item) => ({
      value: item.id,
      label: item.title || item.path,
    })),
  ];
  if (syllabus !== "" && !syllabusItems.some((item) => item.id === syllabus)) {
    syllabusOptions.push({
      value: syllabus,
      label: t("project.bindMissingOption", { id: syllabus }),
    });
  }

  async function save() {
    if (saving || loading) return;
    setSaving(true);
    setSaveError("");
    try {
      // 先拉一次最新快照，再在现有档案上合并四个字段：目录、愿景、目标、
      // 考试日期都由服务端原值带回，不用本页的旧副本覆盖。
      await refresh();
      const live = findStudyProfile(getSnapshot(), projectId) || profile;
      const next = {
        ...live,
        syllabusId: syllabus || null,
        pastPaperIds: past,
        mockPaperIds: mock,
        examMode: examMode === true,
      };
      const result = await tryDispatch({
        type: "education",
        command: { op: "saveProject", project: next },
      });
      if (!result.ok) {
        // core 的完整性校验（含「应试模式必须绑定考纲」）原样显示。
        setSaveError(result.error || t("common.writeFailed"));
        return;
      }
      notify(t("project.bindSaved"), "brand");
    } catch (error) {
      setSaveError(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  return h(
    Card,
    null,
    h(SectionTitle, {
      icon: "education",
      title: t("project.bindTitle"),
      hint: t("project.bindHint"),
      action:
        profile.examMode === true
          ? h(Chip, { tone: "brand" }, t("education.examMode"))
          : null,
    }),
    loadError !== "" ? alertBox(loadError) : null,
    loading
      ? h(
          "div",
          { style: { marginBottom: 10 } },
          h(Skeleton, { w: "46%", h: 13 }),
        )
      : null,
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 14 } },
      h(
        Field,
        {
          label: t("project.bindSyllabus"),
          hint:
            syllabusItems.length === 0
              ? t("project.bindPickHint", {
                  kind: resourceKindLabel("syllabus"),
                })
              : undefined,
        },
        h(Select, {
          value: syllabus,
          options: syllabusOptions,
          onChange: setSyllabus,
          disabled: loading || saving,
          width: "100%",
        }),
      ),
      h(ResourceMultiPick, {
        kind: "pastPaper",
        items: candidates.pastPaper,
        selected: past,
        onChange: setPast,
        disabled: loading || saving,
        loading,
      }),
      h(ResourceMultiPick, {
        kind: "mockPaper",
        items: candidates.mockPaper,
        selected: mock,
        onChange: setMock,
        disabled: loading || saving,
        loading,
      }),
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 10,
            background: "var(--tomato-surface-2)",
          },
        },
        h(
          "div",
          { style: { flex: 1, minWidth: 0 } },
          h(
            "div",
            {
              style: { fontSize: 13.5, color: "var(--tomato-ink)" },
            },
            t("project.bindExamMode"),
          ),
          h(
            "div",
            {
              style: {
                fontSize: 11.5,
                color: "var(--tomato-ink-3)",
                lineHeight: 1.6,
                marginTop: 3,
              },
            },
            t("project.bindExamModeHint"),
          ),
        ),
        h(
          "button",
          {
            type: "button",
            role: "switch",
            "aria-checked": examMode === true,
            "aria-label": t("project.bindExamMode"),
            disabled: saving,
            onClick: () => setExamMode((value) => !value),
            style: {
              width: 40,
              height: 23,
              borderRadius: 23,
              border: "none",
              cursor: saving ? "default" : "pointer",
              padding: 2,
              flex: "none",
              background:
                examMode === true
                  ? "var(--tomato-brand)"
                  : "var(--tomato-surface-3)",
              display: "flex",
              justifyContent: examMode === true ? "flex-end" : "flex-start",
              alignItems: "center",
              opacity: saving ? 0.6 : 1,
            },
          },
          h("span", {
            style: {
              width: 19,
              height: 19,
              borderRadius: "50%",
              background: "#fffdf7",
              boxShadow: "0 1px 3px #00000026",
            },
          }),
        ),
      ),
      saveError !== "" ? alertBox(saveError) : null,
      h(
        "div",
        { style: { display: "flex", justifyContent: "flex-end" } },
        h(
          Btn,
          {
            variant: "primary",
            icon: "check",
            disabled: saving || loading,
            onClick: save,
          },
          saving ? t("project.bindSaving") : t("project.bindSave"),
        ),
      ),
    ),
  );
}
