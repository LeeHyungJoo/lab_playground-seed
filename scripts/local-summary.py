"""Run a pinned public model on CPU. No inference API key or remote Python code."""
import json
import os
import re
import sys

MODEL = 'Qwen/Qwen3-1.7B'
REVISION = '70d244cc86ccca08cf5af4e1e306ecf908b1ad5e'

def parse_output(text):
    text = re.sub(r'^```(?:json)?\s*', '', text.strip(), flags=re.I)
    text = re.sub(r'\s*```$', '', text)
    result = json.loads(text)
    if not isinstance(result, dict):
        raise ValueError('Expected object')
    if not isinstance(result.get('title'), str) or not result['title'].strip():
        raise ValueError('Expected title')
    for key in ('summary', 'why'):
        if not isinstance(result.get(key), str) or not re.search('[가-힣]', result[key]):
            raise ValueError(f'Expected Korean {key}')
    points = result.get('highlights')
    if not isinstance(points, list) or len(points) != 3 or any(not isinstance(x, str) or not re.search('[가-힣]', x) for x in points):
        raise ValueError('Expected three Korean highlights')
    if result.get('category') not in ('AI', '개발 도구'):
        raise ValueError('Invalid category')
    return result

def main():
    payload = json.load(sys.stdin)
    import torch
    from transformers import AutoTokenizer, AutoModelForCausalLM
    torch.set_num_threads(min(4, os.cpu_count() or 1))
    print(f'Loading {MODEL} at {REVISION} on CPU', file=sys.stderr, flush=True)
    tokenizer = AutoTokenizer.from_pretrained(MODEL, revision=REVISION, trust_remote_code=False)
    model = AutoModelForCausalLM.from_pretrained(MODEL, revision=REVISION, torch_dtype=torch.float32, use_safetensors=True, trust_remote_code=False)
    model.eval()
    data = dict(payload['input'])
    data['readme'] = data.get('readme', '')[:5000]
    messages = [
        {'role': 'system', 'content': payload['system']},
        {'role': 'user', 'content': 'Write a short factual introduction IN KOREAN (한국어) using only the repository data below. Use Korean sentences, not English. Return ONLY one JSON object with the exact English keys title, summary, highlights, why, category. highlights must have 3 Korean strings.\n' + json.dumps(data, ensure_ascii=False)},
    ]
    for attempt in range(2):
        text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True, enable_thinking=False)
        inputs = tokenizer(text, return_tensors='pt')
        print(f'Generating Korean summary (attempt {attempt + 1})', file=sys.stderr, flush=True)
        with torch.inference_mode():
            output = model.generate(**inputs, max_new_tokens=800, do_sample=False, pad_token_id=tokenizer.eos_token_id)
        answer = tokenizer.decode(output[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)
        try:
            result = parse_output(answer)
            print(json.dumps(result, ensure_ascii=False))
            return
        except (ValueError, TypeError) as error:
            print(f'Summary validation failed: {error}; generated text: {answer[:1500]}', file=sys.stderr, flush=True)
            messages += [{'role':'assistant','content':answer}, {'role':'user','content':'Your answer was invalid. Translate ALL descriptions into KOREAN (한국어). Do not repeat the English answer. Return only JSON with title, summary, highlights (3 Korean strings), why, category (AI or 개발 도구).'}]
    raise ValueError('Model did not produce a valid Korean summary after two attempts')

if __name__ == '__main__':
    main()
