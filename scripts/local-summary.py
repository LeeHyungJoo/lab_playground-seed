"""Run a pinned public model on CPU. No inference API key or remote Python code."""
import json
import os
import re
import sys

MODEL = 'Qwen/Qwen2.5-1.5B-Instruct'
REVISION = '989aa7980e4cf806f80c7fef2b1adb7bc71aa306'

def parse_output(text):
    text = re.sub(r'^```(?:json)?\s*', '', text.strip(), flags=re.I)
    text = re.sub(r'\s*```$', '', text)
    result = json.loads(text)
    if not isinstance(result, dict):
        raise ValueError('Expected object')
    for key in ('title', 'summary', 'why'):
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
        {'role': 'user', 'content': '다음 자료로 짧은 한국어 소개를 작성하세요. JSON만 출력하세요. 각 문장은 짧게 작성하세요.\n' + json.dumps(data, ensure_ascii=False)},
    ]
    for attempt in range(2):
        text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
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
            print(f'Summary validation failed: {error}', file=sys.stderr, flush=True)
            messages += [{'role':'assistant','content':answer}, {'role':'user','content':'위 응답의 형식을 고쳐주세요. 모든 설명은 한국어로 작성하세요. title, summary, highlights(문자열 3개 배열), why, category(AI 또는 개발 도구) 필드를 가진 JSON만 출력하세요.'}]
    raise ValueError('Model did not produce a valid Korean summary after two attempts')

if __name__ == '__main__':
    main()
