#!/usr/bin/env python3
"""Check a paper's structure and blueprint totals, not its factual quality."""

import argparse
import json
from pathlib import Path
import sys


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def positive_int(value):
    return type(value) is int and value > 0


def string_list(value):
    return (
        isinstance(value, list)
        and bool(value)
        and all(nonempty(item) for item in value)
        and len(set(value)) == len(value)
    )


def check(paper, allowed_sources, points, question_count, minutes):
    errors = []
    if not isinstance(paper, dict):
        return ["试卷必须是JSON对象"], {}
    for key in ("title", "instructions", "reviewEvidence"):
        if not nonempty(paper.get(key)):
            errors.append(f"{key}: 必须有非空文本")
    questions = paper.get("questions")
    if not isinstance(questions, list) or not questions:
        return errors + ["questions: 必须是非空数组"], {}
    if len(questions) != question_count:
        errors.append(f"题数 {len(questions)} 与蓝图 {question_count} 不符")
    seen_ids, seen_prompts = set(), set()
    total_points, estimated_minutes = 0, 0
    for number, question in enumerate(questions, 1):
        prefix = f"题{number}"
        if not isinstance(question, dict):
            errors.append(f"{prefix}: 必须是对象")
            continue
        question_id = question.get("id")
        if not nonempty(question_id):
            errors.append(f"{prefix}: 缺少题目ID")
        elif question_id in seen_ids:
            errors.append(f"{prefix}: 重复题目ID {question_id}")
        else:
            seen_ids.add(question_id)
        for key in ("prompt", "answer", "acceptableAlternatives"):
            if not nonempty(question.get(key)):
                errors.append(f"{prefix}.{key}: 必须有非空文本")
        if nonempty(question.get("prompt")):
            normalized = " ".join(question["prompt"].split())
            if normalized in seen_prompts:
                errors.append(f"{prefix}: 重复题面，请核对是否误复制")
            seen_prompts.add(normalized)
        if not string_list(question.get("topics")):
            errors.append(f"{prefix}.topics: 必须是非空、不重复的字符串数组")
        source_ids = question.get("sourceIds")
        if not string_list(source_ids):
            errors.append(f"{prefix}.sourceIds: 必须是非空、不重复的字符串数组")
        else:
            for source_id in source_ids:
                if source_id not in allowed_sources:
                    errors.append(f"{prefix}: 未登记来源ID {source_id}")
        if type(question.get("extension")) is not bool:
            errors.append(f"{prefix}.extension: 必须是布尔值")
        estimate = question.get("estimatedMinutes")
        if not positive_int(estimate):
            errors.append(f"{prefix}.estimatedMinutes: 必须是正整数")
        else:
            estimated_minutes += estimate
        scoring = question.get("scoring")
        if not isinstance(scoring, list) or not scoring:
            errors.append(f"{prefix}.scoring: 必须有评分点")
            continue
        point_ids = set()
        for index, point in enumerate(scoring, 1):
            label = f"{prefix}评分点{index}"
            if not isinstance(point, dict):
                errors.append(f"{label}: 必须是对象")
                continue
            point_id = point.get("id")
            if not nonempty(point_id):
                errors.append(f"{label}: 缺少ID")
            elif point_id in point_ids:
                errors.append(f"{label}: 重复评分点ID {point_id}")
            else:
                point_ids.add(point_id)
            if not nonempty(point.get("description")):
                errors.append(f"{label}: 缺少判分依据")
            if not positive_int(point.get("points")):
                errors.append(f"{label}: 分值必须是正整数")
            else:
                total_points += point["points"]
    if total_points != points:
        errors.append(f"评分点总分 {total_points} 与蓝图 {points} 不符")
    if estimated_minutes > minutes:
        errors.append(f"估时合计 {estimated_minutes} 分钟超过蓝图窗口 {minutes} 分钟")
    if "startsAt" in paper or "endsAt" in paper:
        start, end = paper.get("startsAt"), paper.get("endsAt")
        if type(start) is not int or type(end) is not int or end <= start:
            errors.append("startsAt/endsAt: 必须是递增的Unix秒整数")
        elif end - start != minutes * 60:
            errors.append("实际考试窗口与蓝图分钟数不符")
    return errors, {
        "questionCount": len(questions),
        "points": total_points,
        "estimatedMinutes": estimated_minutes,
        "windowMinutes": minutes,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paper", type=Path)
    parser.add_argument("--points", type=int, required=True)
    parser.add_argument("--questions", type=int, required=True)
    parser.add_argument("--minutes", type=int, required=True)
    parser.add_argument("--sources", type=Path, required=True,
                        help="JSON array of actual resource/source IDs")
    args = parser.parse_args()
    if not all(positive_int(value) for value in
               (args.points, args.questions, args.minutes)):
        parser.error("蓝图总分、题数与分钟数必须为正整数")
    try:
        paper = json.loads(args.paper.read_text(encoding="utf-8-sig"))
        sources = json.loads(args.sources.read_text(encoding="utf-8-sig"))
        if not string_list(sources):
            raise ValueError("来源文件必须是非空、不重复的ID字符串数组")
    except (OSError, UnicodeError, ValueError) as error:
        print(json.dumps({"ok": False, "inputError": str(error)}, ensure_ascii=False))
        return 2
    errors, summary = check(paper, set(sources), args.points, args.questions, args.minutes)
    print(json.dumps({"ok": not errors, "summary": summary, "errors": errors},
                     ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
