# -*- coding: utf-8 -*-
"""
A lightweight similarity calculator invoked from Node.js to compute semantic similarity
between OCR text and STT text. It uses a simple TF-IDF + cosine similarity approach
as a fast, dependency-light solution. Can be replaced with a BERT-based model later.

Usage (from Node):
  python3 similarity_calculator.py "OCR text here" "STT text here"

Output (JSON):
  {
    "similarity_score": 0.83,
    "jaccard": 0.76,
    "cosine": 0.83,
    "levenshtein": 42
  }
"""

import sys
import json
import math
import re
from collections import Counter

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    SKLEARN_AVAILABLE = True
except Exception:
    SKLEARN_AVAILABLE = False


def clean_text(text: str) -> str:
    if not isinstance(text, str):
        return ""
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def jaccard_similarity(a_tokens, b_tokens) -> float:
    set_a = set(a_tokens)
    set_b = set(b_tokens)
    if not set_a and not set_b:
        return 1.0
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union if union else 0.0


def levenshtein_distance(a: str, b: str) -> int:
    if a == b:
        return 0
    if len(a) == 0:
        return len(b)
    if len(b) == 0:
        return len(a)

    prev_row = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        curr_row = [i]
        for j, cb in enumerate(b, start=1):
            insertions = prev_row[j] + 1
            deletions = curr_row[j - 1] + 1
            substitutions = prev_row[j - 1] + (ca != cb)
            curr_row.append(min(insertions, deletions, substitutions))
        prev_row = curr_row
    return prev_row[-1]


def cosine_similarity_fallback(a: str, b: str) -> float:
    def to_vec(tokens):
        return Counter(tokens)

    a_tokens = a.split()
    b_tokens = b.split()
    a_vec = to_vec(a_tokens)
    b_vec = to_vec(b_tokens)

    all_keys = set(a_vec.keys()) | set(b_vec.keys())
    dot = sum(a_vec.get(k, 0) * b_vec.get(k, 0) for k in all_keys)
    norm_a = math.sqrt(sum(v * v for v in a_vec.values()))
    norm_b = math.sqrt(sum(v * v for v in b_vec.values()))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


def cosine_similarity_sklearn(a: str, b: str) -> float:
    vectorizer = TfidfVectorizer()
    tfidf = vectorizer.fit_transform([a, b])
    sim = cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0]
    return float(sim)


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: python3 similarity_calculator.py <ocr_text> <stt_text>"}))
        sys.exit(1)

    ocr_text = sys.argv[1]
    stt_text = sys.argv[2]

    a = clean_text(ocr_text)
    b = clean_text(stt_text)

    jacc = jaccard_similarity(a.split(), b.split())

    if SKLEARN_AVAILABLE:
        cos = cosine_similarity_sklearn(a, b)
    else:
        cos = cosine_similarity_fallback(a, b)

    lev = levenshtein_distance(a, b)

    combined = 0.6 * cos + 0.4 * jacc

    result = {
        "similarity_score": round(float(combined), 4),
        "jaccard": round(float(jacc), 4),
        "cosine": round(float(cos), 4),
        "levenshtein": int(lev)
    }
    print(json.dumps(result))

if __name__ == "__main__":
    main()
