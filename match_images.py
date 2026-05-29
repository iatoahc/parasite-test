import os
import json
import re

def parse_deck_data():
    app_js_path = r"c:\Users\tlcha\Documents\parasite poker\app.js"
    with open(app_js_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # 尋找 DECK_DATA 陣列
    # 由於 javascript 格式可能有多行，我們使用正則提取 rank 至 examKey 的物件
    # 我們可以用正則提取每一個物件
    # 例如：{ rank: ..., nameEn: '...', nameZh: '...', ... }
    
    # 簡單的做法是尋找所有 nameEn, nameZh, examKey, organText 等屬性
    # 我們可以使用正則表達式，提取每個物件的內容
    # 為了高精確度，我們可以用正則找 { ... }
    # 由於有些括號嵌套，我們可以用一個簡單的狀態機或正則來切分 card 物件
    # 這裡我們使用正則尋找每一個 card 的定義區間
    cards_raw = re.findall(r'\{\s*rank:\s*[\'\"][^\'\"]+[\'\"].*?examKey:\s*[\'\"][^\'\"]+[\'\"]\s*\}', content, re.DOTALL)
    
    deck = []
    for raw in cards_raw:
        card = {}
        # 提取 nameEn
        name_en_match = re.search(r'nameEn:\s*[\'\"]([^\'\"]+)[\'\"]', raw)
        name_zh_match = re.search(r'nameZh:\s*[\'\"]([^\'\"]+)[\'\"]', raw)
        organ_match = re.search(r'organText:\s*[\'\"]([^\'\"]+)[\'\"]', raw)
        stage_match = re.search(r'stageText:\s*[\'\"]([^\'\"]+)[\'\"]', raw)
        host_match = re.search(r'hostText:\s*[\'\"]([^\'\"]+)[\'\"]', raw)
        host_icon_match = re.search(r'hostIcon:\s*[\'\"]([^\'\"]+)[\'\"]', raw)
        exam_key_match = re.search(r'examKey:\s*[\'\"]([^\'\"]+)[\'\"]', raw)
        details_match = re.search(r'details:\s*[\'\"]([^\'\"]+)[\'\"]', raw)
        suit_match = re.search(r'suit:\s*[\'\"]([^\'\"]+)[\'\"]', raw)
        
        if name_en_match and name_zh_match:
            card['nameEn'] = name_en_match.group(1).strip()
            card['nameZh'] = name_zh_match.group(1).strip()
            card['organText'] = organ_match.group(1).strip() if organ_match else ""
            card['stageText'] = stage_match.group(1).strip() if stage_match else ""
            card['hostText'] = host_match.group(1).strip() if host_match else ""
            card['hostIcon'] = host_icon_match.group(1).strip() if host_icon_match else "👤"
            card['examKey'] = exam_key_match.group(1).strip() if exam_key_match else ""
            card['details'] = details_match.group(1).strip() if details_match else ""
            card['suit'] = suit_match.group(1).strip() if suit_match else ""
            deck.append(card)
            
    print(f"Extracted {len(deck)} cards from app.js")
    return deck

def main():
    deck = parse_deck_data()
    
    pic_dir = r"c:\Users\tlcha\Documents\parasite poker\pictures"
    files = os.listdir(pic_dir)
    
    quiz_questions = []
    lifecycle_gallery = []
    
    unmatched_files = []
    
    # 建立對比字典 (學名轉卡牌資料)
    # 我們有些學名在檔名中可能有些微差異，例如多空格，或是縮寫
    # 我們做不區分大小寫且去除標點的匹配
    def clean_name(s):
        return re.sub(r'[^a-zA-Z0-9]', '', s).lower()
        
    deck_by_name = {}
    for card in deck:
        cleaned = clean_name(card['nameEn'])
        deck_by_name[cleaned] = card
        # 也加入 genus + species
        # 例如 "Ascaris lumbricoides" -> "ascarislumbricoides"
    
    # 我們也額外為一些特殊檔名手動對應到 DECK_DATA 裡面的寄生蟲
    custom_mappings = {
        "hookwarm": "Ancylostoma duodenale", # 鉤蟲生活史對應到十二指腸鉤蟲
    }
    
    for f in files:
        if not f.lower().endswith(('.jpg', '.jpeg', '.png', '.gif')):
            continue
            
        name_without_ext = os.path.splitext(f)[0]
        
        # 判斷是否為 life cycle
        is_lifecycle = any(x in name_without_ext.lower() for x in ["life cycle", "lifecycle", "life_cycle"])
        
        # 解析學名
        # 檔名前面通常是兩個字，例如 "Ascaris lumbricoides"
        # 我們將檔名與 deck 裡面的 nameEn 進行子字串匹配
        matched_card = None
        
        # 1. 嘗試直接比對 (如果檔名包含學名)
        for clean_en, card in deck_by_name.items():
            # 檢查 card['nameEn'] 是否出現在檔名中 (不區分大小寫、空格)
            card_name_clean = clean_name(card['nameEn'])
            file_name_clean = clean_name(name_without_ext)
            if card_name_clean in file_name_clean:
                matched_card = card
                break
                
        # 2. 嘗試自定義對應
        if not matched_card:
            for key, val in custom_mappings.items():
                if key in name_without_ext.lower():
                    # 找到對應的卡片
                    for clean_en, card in deck_by_name.items():
                        if clean_name(val) in clean_en:
                            matched_card = card
                            break
                    if matched_card:
                        break
                        
        # 3. 嘗試用屬名 (Genus) 模糊匹配
        if not matched_card:
            # 檔名第一個字
            parts = re.split(r'[\s_]+', name_without_ext)
            if len(parts) >= 1:
                genus_candidate = parts[0].lower()
                for clean_en, card in deck_by_name.items():
                    if card['nameEn'].lower().startswith(genus_candidate):
                        matched_card = card
                        break
                        
        # 提取型態
        # 去掉學名後的部分
        stage = "Unknown"
        if matched_card:
            # 從檔名中移除學名，剩下的就是型態
            # 例如 "Ancylostoma caninum adult" -> "adult"
            card_name_parts = matched_card['nameEn'].split()
            # 嘗試在檔名中移除這些單字
            temp = name_without_ext
            for part in card_name_parts:
                # 忽略大小寫替換
                temp = re.sub(re.escape(part), '', temp, flags=re.IGNORECASE)
            
            # 清理剩餘的字元，例如數字或符號
            stage_raw = temp.strip(" _-")
            
            # 將常用的型態做漂亮的中文翻譯
            stage_lower = stage_raw.lower()
            if "egg" in stage_lower:
                stage = "Egg (蟲卵)"
            elif "adult" in stage_lower:
                stage = "Adult (成蟲)"
            elif "larva" in stage_lower or "larvae" in stage_lower:
                stage = "Larva (幼蟲)"
            elif "microfilaria" in stage_lower:
                stage = "Microfilaria (微絲蚴)"
            elif "l3" in stage_lower:
                stage = "L3 Larva (第三期感染性幼蟲)"
            elif "cyst" in stage_lower:
                stage = "Cyst (包囊)"
            elif "trophozoite" in stage_lower:
                stage = "Trophozoite (滋養體)"
            elif "amastigote" in stage_lower:
                stage = "Amastigote (無鞭毛體)"
            elif "promastigote" in stage_lower:
                stage = "Promastigote (前鞭毛體)"
            elif "gametocyte" in stage_lower:
                stage = "Gametocyte (配子體)"
            elif "schizont" in stage_lower:
                stage = "Schizont (裂殖體)"
            elif "ring" in stage_lower:
                stage = "Ring form (環狀體)"
            elif "sparganum" in stage_lower:
                stage = "Sparganum (裂頭幼蟲)"
            elif "plerocercoid" in stage_lower:
                stage = "Plerocercoid (實尾幼蟲)"
            elif "body" in stage_lower:
                stage = "Proglottids (節片/蟲體)"
            elif "life cycle" in stage_lower or "lifecycle" in stage_lower:
                stage = "Life Cycle (生活史)"
            elif stage_raw:
                # 保留原本英文
                stage = f"{stage_raw.capitalize()}"
            else:
                stage = "Diagnostic Stage (診斷型態)"
        else:
            # 未匹配到學名
            unmatched_files.append(f)
            # 默認從檔名拆分
            parts = re.split(r'[\s_]+', name_without_ext)
            if len(parts) >= 2:
                stage = " ".join(parts[2:]) if len(parts) > 2 else "Unknown"
            else:
                stage = "Unknown"
                
        # 建立結構化資料
        img_info = {
            "id": name_without_ext.replace(" ", "_"),
            "filename": f,
            "filepath": f"pictures/{f}",
            "stage": stage,
            "isLifecycle": is_lifecycle,
            "parasite": {
                "nameEn": matched_card['nameEn'] if matched_card else name_without_ext,
                "nameZh": matched_card['nameZh'] if matched_card else "未知寄生蟲",
                "suit": matched_card['suit'] if matched_card else "joker",
                "organText": matched_card['organText'] if matched_card else "未知",
                "hostText": matched_card['hostText'] if matched_card else "未知",
                "hostIcon": matched_card['hostIcon'] if matched_card else "👤",
                "examKey": matched_card['examKey'] if matched_card else "暫無考點說明，請熟記圖片特徵。",
                "details": matched_card['details'] if matched_card else ""
            }
        }
        
        if is_lifecycle:
            lifecycle_gallery.append(img_info)
        else:
            quiz_questions.append(img_info)
            
    print(f"Total matched: {len(quiz_questions) + len(lifecycle_gallery)} files.")
    print(f"Quiz Questions (excl. Life Cycle): {len(quiz_questions)}")
    print(f"Life Cycle Gallery (study only): {len(lifecycle_gallery)}")
    print(f"Unmatched files: {len(unmatched_files)}")
    if unmatched_files:
        print("Unmatched sample:", unmatched_files[:5])
        
    # 輸出為 JS 檔案
    output_js = r"c:\Users\tlcha\Documents\parasite poker\quiz_db.js"
    with open(output_js, "w", encoding="utf-8") as out:
        out.write("/* Automatically matched and generated by match_images.py */\n")
        out.write("const QUIZ_QUESTIONS = ")
        json.dump(quiz_questions, out, ensure_ascii=False, indent=4)
        out.write(";\n\n")
        out.write("const LIFECYCLE_GALLERY = ")
        json.dump(lifecycle_gallery, out, ensure_ascii=False, indent=4)
        out.write(";\n")
        
    print(f"Successfully generated quiz_db.js at {output_js}")

if __name__ == "__main__":
    main()
