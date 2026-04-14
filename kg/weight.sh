#!/usr/bin/env zsh

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
DATE_IMPL=""

detect_date_impl() {
  if date -d '1970-01-01 UTC' '+%s' >/dev/null 2>&1; then
    DATE_IMPL="gnu"
  elif date -j -f "%Y-%m-%d" "1970-01-01" "+%s" >/dev/null 2>&1; then
    DATE_IMPL="bsd"
  else
    echo "当前系统的 date 命令不受支持" >&2
    exit 1
  fi
}

normalize_date() {
  case "$DATE_IMPL" in
    gnu)
      TZ=UTC date -d "$1" "+%Y-%m-%d"
      ;;
    bsd)
      TZ=UTC date -j -f "%Y-%m-%d" "$1" "+%Y-%m-%d"
      ;;
  esac
}

is_valid_date() {
  local normalized

  normalized=$(normalize_date "$1" 2>/dev/null) || return 1
  [[ "$normalized" == "$1" ]]
}

date_to_epoch() {
  case "$DATE_IMPL" in
    gnu)
      TZ=UTC date -d "$1" "+%s"
      ;;
    bsd)
      TZ=UTC date -j -f "%Y-%m-%d" "$1" "+%s"
      ;;
  esac
}

date_add_days() {
  local base_date="$1"
  local days="$2"

  case "$DATE_IMPL" in
    gnu)
      TZ=UTC date -d "$base_date +${days} day" "+%Y-%m-%d"
      ;;
    bsd)
      TZ=UTC date -j -v+"${days}"d -f "%Y-%m-%d" "$base_date" "+%Y-%m-%d"
      ;;
  esac
}

is_valid_weight() {
  [[ "$1" =~ ^[0-9]+([.][0-9]+)?$ ]]
}

prompt_weight() {
  local prompt="$1"
  local value

  while true; do
    printf "%s" "$prompt"
    IFS= read -r value || return 1

    if [[ -z "$value" ]]; then
      REPLY=""
      return 0
    fi

    if is_valid_weight "$value"; then
      REPLY="$value"
      return 0
    fi

    echo "体重格式无效，请输入数字，例如 61.8"
  done
}

prompt_required_date() {
  local prompt="$1"
  local value

  while true; do
    printf "%s" "$prompt"
    IFS= read -r value || return 1

    if [[ -z "$value" ]]; then
      echo "日期不能为空"
      continue
    fi

    if ! is_valid_date "$value"; then
      echo "日期格式无效，请输入 YYYY-MM-DD"
      continue
    fi

    REPLY="$value"
    return 0
  done
}

detect_date_impl

# ===== 1. 选择文件 =====
read "choice?选择文件 (y/x, 默认 y): "
choice=${choice:-y}

if [[ "$choice" != "y" && "$choice" != "x" ]]; then
  echo "仅支持 y 或 x"
  exit 1
fi

FILE="${SCRIPT_DIR}/src/${choice}.js"

if [[ ! -f "$FILE" ]]; then
  echo "文件不存在: $FILE"
  exit 1
fi

# ===== 2. 获取最后日期 =====
last_line=$(grep '\["' "$FILE" | tail -1)
last_date=$(echo "$last_line" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')

[[ -z "$last_date" ]] && echo "解析日期失败" && exit 1

echo "最后记录日期: $last_date"

# ===== 3. 获取今天日期 =====
today=$(date +%Y-%m-%d)
echo "今天日期: $today"

# ===== 4. 计算日期差 =====
diff_days=$(( ( $(date_to_epoch "$today") - $(date_to_epoch "$last_date") ) / 86400 ))

echo "间隔天数: $diff_days"

new_entries=()

# ===== 5. 三种情况 =====

if [[ $diff_days -eq 1 ]]; then
  prompt_weight "请输入今天体重: "
  [[ -n "$REPLY" ]] && new_entries+=("[\"$today\",$REPLY],")

elif [[ $diff_days -eq 0 ]]; then
  echo "今天已有记录，无需追加"
  exit 0

elif [[ $diff_days -lt 0 ]]; then
  echo "最后记录日期晚于今天，请先检查数据文件"
  exit 1

elif [[ $diff_days -le 5 ]]; then
  echo "👉 逐天输入（回车跳过）"

  for ((i=1; i<=diff_days; i++)); do
    d=$(date_add_days "$last_date" "$i")
    prompt_weight "$d: "
    [[ -n "$REPLY" ]] && new_entries+=("[\"$d\",$REPLY],")
  done

else
  prompt_required_date "请输入日期 (YYYY-MM-DD): "
  d="$REPLY"

  if (( $(date_to_epoch "$d") <= $(date_to_epoch "$last_date") )); then
    echo "日期必须晚于最后记录日期: $last_date"
    exit 1
  fi

  prompt_weight "请输入体重: "
  [[ -n "$REPLY" ]] && new_entries+=("[\"$d\",$REPLY],")
fi

# ===== 6. 写入文件 =====

if [[ ${#new_entries[@]} -eq 0 ]]; then
  echo "没有新增数据"
  exit 0
fi

# 插入到最后一个 ]; 之前
tmp_file=$(mktemp)

awk -v entries="$(printf "%s\n" "${new_entries[@]}")" '
  {
    lines[NR] = $0
    if ($0 ~ /\];/) {
      last = NR
    }
  }
  END {
    if (!last) {
      exit 1
    }

    for (i = 1; i <= NR; i++) {
      if (i == last) {
        print entries
      }
      print lines[i]
    }
  }
' "$FILE" > "$tmp_file"

mv "$tmp_file" "$FILE"

echo "✅ 已追加数据到 $FILE"

echo "准备开始编译"
bash "$SCRIPT_DIR/pkg.sh"

echo "✅ 编译完成"

read "confirm?是否提交 Git（仅构建产物，不含数据文件）？(y/n, 默认 y): "
confirm=${confirm:-n}

if [[ "$confirm" == "y" || "$confirm" == "Y" ]]; then
  echo "提交 Git"
  git -C "$SCRIPT_DIR" add -- "$SCRIPT_DIR/js/index.min.js" "$SCRIPT_DIR/backup"

  if git -C "$SCRIPT_DIR" diff --cached --quiet; then
    echo "没有可提交的变更"
    exit 0
  fi

  git -C "$SCRIPT_DIR" commit -m "update data"
  git -C "$SCRIPT_DIR" push
else
  echo "已跳过 Git 提交"
fi
