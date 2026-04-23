"""
俄语字符转英语字符工具
避免乱码问题
"""
import re


# 俄语到英语的转写映射表
RUSSIAN_TO_LATIN = {
    'А': 'A', 'а': 'a',
    'Б': 'B', 'б': 'b',
    'В': 'V', 'в': 'v',
    'Г': 'G', 'г': 'g',
    'Д': 'D', 'д': 'd',
    'Е': 'E', 'е': 'e',
    'Ё': 'Yo', 'ё': 'yo',
    'Ж': 'Zh', 'ж': 'zh',
    'З': 'Z', 'з': 'z',
    'И': 'I', 'и': 'i',
    'Й': 'Y', 'й': 'y',
    'К': 'K', 'к': 'k',
    'Л': 'L', 'л': 'l',
    'М': 'M', 'м': 'm',
    'Н': 'N', 'н': 'n',
    'О': 'O', 'о': 'o',
    'П': 'P', 'п': 'p',
    'Р': 'R', 'р': 'r',
    'С': 'S', 'с': 's',
    'Т': 'T', 'т': 't',
    'У': 'U', 'у': 'u',
    'Ф': 'F', 'ф': 'f',
    'Х': 'Kh', 'х': 'kh',
    'Ц': 'Ts', 'ц': 'ts',
    'Ч': 'Ch', 'ч': 'ch',
    'Ш': 'Sh', 'ш': 'sh',
    'Щ': 'Shch', 'щ': 'shch',
    'Ъ': '', 'ъ': '',
    'Ы': 'Y', 'ы': 'y',
    'Ь': '', 'ь': '',
    'Э': 'E', 'э': 'e',
    'Ю': 'Yu', 'ю': 'yu',
    'Я': 'Ya', 'я': 'ya',
}


def transliterate_russian(text: str) -> str:
    """
    将俄语字符转换为英语字符
    
    Args:
        text: 包含俄语字符的文本
        
    Returns:
        转换后的英语文本
    """
    if not text:
        return text
    
    result = []
    for char in text:
        if char in RUSSIAN_TO_LATIN:
            result.append(RUSSIAN_TO_LATIN[char])
        else:
            result.append(char)
    
    return ''.join(result)


def clean_text(text: str) -> str:
    """
    清理文本，移除特殊字符，保留字母、数字、空格和常用标点
    
    Args:
        text: 原始文本
        
    Returns:
        清理后的文本
    """
    if not text:
        return text
    
    # 先转写俄语字符
    text = transliterate_russian(text)
    
    # 保留字母、数字、空格和常用标点，增加对 / 和 & 的支持
    text = re.sub(r'[^\w\s\-.,;:()\[\]{}/&]', '', text)
    
    # 移除多余空格
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

