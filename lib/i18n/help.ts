import type { Locale } from "@/types";

export interface HelpSection {
  id: string;
  title: string;
  steps: string[];
}

/** In-app user guide (Settings → 使用說明). Kept per locale like the other UI text. */
export const HELP: Record<Locale, HelpSection[]> = {
  "zh-HK": [
    {
      id: "start",
      title: "1. 第一次使用（家長）",
      steps: [
        "去「設定」→「家長設定」，用預設家長 PIN 0000 解鎖。",
        "第一時間喺「家長 PIN」改成你自己嘅 4 位數字。",
        "喺「新增學生」輸入名稱同 4 位數字 PIN，最多 8 個學生。",
        "喺「切換學生」揀學生，再輸入佢嘅 PIN，就可以開始。",
      ],
    },
    {
      id: "install",
      title: "2. 加入主畫面（當 App 用）",
      steps: [
        "iPhone／iPad：用 Safari 開，撳「分享」→「加入主畫面」。",
        "Android／電腦 Chrome：撳網址列嘅安裝圖示，或者選單 →「安裝應用程式」。",
        "開過一次之後，冇網絡都可以照常默書。",
      ],
    },
    {
      id: "lists",
      title: "3. 輸入默書範圍",
      steps: [
        "入「中文默書」或「英文默書」，撳「＋ 新增範圍」。",
        "生字／詞語：每行一個；可以喺「|」後面加提示，例如 apple | 蘋果。",
        "課文（混合）：可以逐段輸入（➕ 加多一段／✕ 刪除呢段），或者「📋 貼上成段課文」自動分段，見到 。！？，； 會自動分句；核對好先儲存。",
        "類型建立後不能更改，編輯時唔會整走任何資料。",
      ],
    },
    {
      id: "practice",
      title: "4. 默書練習",
      steps: [
        "撳「▶ 開始默書」，揀紙筆默書或打字作答、次序同語速；課文可以揀逐段、隨機抽段或全部。",
        "系統會讀出詞語同標點符號；中文可以揀廣東話或普通話，亦有重聽、🔁 重複聆聽、🐢 慢些讀。",
        "紙筆默書：寫完撳「📖 顯示答案」（課文要默完成段先顯示），睇筆劃動畫，再自己揀 ✓ 啱／✗ 錯。",
        "打字作答：自動對答案。跟課文標準：英文分大小寫，標點都要寫。",
      ],
    },
    {
      id: "mistakes",
      title: "5. 錯字重溫",
      steps: [
        "默錯嘅詞語同句子會自動記錄喺「錯字重溫」。",
        "連續答啱 2 次就算掌握；之後再錯會返回待重溫。",
      ],
    },
    {
      id: "progress",
      title: "6. 學習紀錄",
      steps: [
        "主頁「學習紀錄」卡或者學習紀錄頁，可以睇連續練習日數、正確率、最近 14 日圖表同最常錯嘅字。",
        "家長可以喺「家長設定」撳每個學生嘅「📊 紀錄」，唔使切換學生。",
      ],
    },
    {
      id: "backup",
      title: "7. 備份（重要）",
      steps: [
        "所有資料只儲存喺呢部機。清除瀏覽器資料或者換機，資料就會冇晒。",
        "喺「家長設定」→「⬇️ 匯出備份」，建議每星期一次；iPhone／iPad 可以用「📤 分享備份」存去「檔案」。",
        "還原：「⬆️ 匯入備份」，再揀「合併」或「取代全部」。",
      ],
    },
    {
      id: "privacy",
      title: "8. 私隱同安全",
      steps: [
        "資料唔會上傳到任何伺服器。",
        "PIN 只係用嚟喺同一部機切換學生，唔係安全密碼。",
        "忘記家長 PIN：清除呢個網站嘅資料（家長 PIN 會變返 0000），再用備份檔還原學習資料。",
      ],
    },
  ],
  en: [
    {
      id: "start",
      title: "1. First time (parents)",
      steps: [
        "Go to Settings → Owner Settings and unlock with the default owner PIN 0000.",
        "Change it to your own 4-digit PIN under “Owner PIN” right away.",
        "Add students with a name and a 4-digit PIN (up to 8).",
        "Under “Switch student”, pick a student and enter their PIN to start.",
      ],
    },
    {
      id: "install",
      title: "2. Add to Home Screen",
      steps: [
        "iPhone / iPad: open in Safari, tap Share → “Add to Home Screen”.",
        "Android / desktop Chrome: use the install icon in the address bar, or the menu → “Install app”.",
        "After opening it once, it works without internet.",
      ],
    },
    {
      id: "lists",
      title: "3. Enter word lists",
      steps: [
        "Open Chinese or English Dictation and tap “+ New list”.",
        "Words: one per line; add a hint after “|”, e.g. apple | 蘋果.",
        "Passage (mixed): type paragraph by paragraph (➕ / ✕), or “📋 Paste whole passage” to split paragraphs and sentences automatically (。！？，； . ! ? , ;). Check before saving.",
        "The type can't be changed later, so editing never drops any data.",
      ],
    },
    {
      id: "practice",
      title: "4. Practise",
      steps: [
        "Tap “▶ Start”, choose paper & pen or typing, order and speed; for passages choose one, random or all paragraphs.",
        "Words and punctuation are read aloud; Chinese can use Cantonese or Mandarin, with replay, 🔁 repeat and 🐢 slower.",
        "Paper & pen: tap “📖 Show answer” (a passage paragraph is shown once it's finished), watch the strokes, then mark ✓ / ✗ yourself.",
        "Typing: checked automatically, following the textbook — English is case-sensitive and punctuation counts.",
      ],
    },
    {
      id: "mistakes",
      title: "5. Mistake Review",
      steps: [
        "Wrong words and sentences are recorded automatically.",
        "Get one right 2 times in a row to master it; a later mistake brings it back.",
      ],
    },
    {
      id: "progress",
      title: "6. Progress",
      steps: [
        "The Progress card / page shows the streak, accuracy, a 14-day chart and the most missed words.",
        "Parents can tap “📊 Progress” for any student in Owner Settings without switching profile.",
      ],
    },
    {
      id: "backup",
      title: "7. Backup (important)",
      steps: [
        "All data lives only on this device — clearing browser data or changing device loses it.",
        "Owner Settings → “⬇️ Export backup”, ideally weekly; on iPhone / iPad use “📤 Share backup” to save to Files.",
        "To restore: “⬆️ Import backup”, then Merge or Replace all.",
      ],
    },
    {
      id: "privacy",
      title: "8. Privacy & safety",
      steps: [
        "Nothing is uploaded to any server.",
        "PINs only switch profiles on this device — they are not secure passwords.",
        "Forgot the owner PIN: clear this site's data (the owner PIN goes back to 0000), then restore learning data from a backup.",
      ],
    },
  ],
};
