#!/bin/zsh

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)

# ===== 1. 选择文件 =====
read "choice?选择文件 (y/x, 默认 y): "
choice=${choice:-y}

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
diff_days=$(( ( $(date -j -f "%Y-%m-%d" "$today" +%s) - \
                 $(date -j -f "%Y-%m-%d" "$last_date" +%s) ) / 86400 ))

echo "间隔天数: $diff_days"

new_entries=()

# ===== 5. 三种情况 =====

if [[ $diff_days -eq 1 ]]; then
  read "w?请输入今天体重: "
  [[ -n "$w" ]] && new_entries+=("[\"$today\",$w],")

elif [[ $diff_days -le 5 ]]; then
  echo "👉 逐天输入（回车跳过）"

  for ((i=1; i<=diff_days; i++)); do
    d=$(date -j -v+${i}d -f "%Y-%m-%d" "$last_date" +%Y-%m-%d)
    read "w?$d: "
    [[ -n "$w" ]] && new_entries+=("[\"$d\",$w],")
  done

else
  read "d?请输入日期 (YYYY-MM-DD): "
  read "w?请输入体重: "
  [[ -n "$d" && -n "$w" ]] && new_entries+=("[\"$d\",$w],")
fi

# ===== 6. 写入文件 =====

if [[ ${#new_entries[@]} -eq 0 ]]; then
  echo "没有新增数据"
  exit 0
fi

# 插入到最后一个 ] 之前
tmp_file=$(mktemp)

awk -v entries="$(printf "%s\n" "${new_entries[@]}")" '
  /\];/ {
    print entries
  }
  { print }
' "$FILE" > "$tmp_file"

mv "$tmp_file" "$FILE"

echo "✅ 已追加数据到 $FILE"

echo "准备开始编译"
bash pkg.sh

echo "✅ 编译完成"

echo "提交 Git"
git add . && git commit -m "update data" && git push
