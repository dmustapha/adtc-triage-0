---
language:
- en
license: apache-2.0
license_link: https://huggingface.co/qvac/MedPsy-1.7B/blob/main/LICENSE
library_name: transformers
base_model:
- Qwen/Qwen3-1.7B
tags:
- medical
- healthcare
- clinical
- edge
- qwen3
- tether-ai
- text-generation
- on-device
pipeline_tag: text-generation
---

# MedPsy-1.7B

**MedPsy-1.7B** is a state-of-the-art, text-only medical and healthcare language model purpose-built for edge and smartphone deployment. Built on top of Qwen3-1.7B (operated in thinking mode, i.e. with `enable_thinking=True`) and post-trained with a multi-stage pipeline (supervised fine-tuning + reinforcement learning) on curated medical data, it delivers medical reasoning capabilities previously exclusive to models 2–7x its size.

| | |
|:---|:---|
| **Developed by** | [Tether AI Research](https://tether.io/) |
| **Model type** | Text-only causal language model (decoder-only transformer) |
| **Base model** | [Qwen3-1.7B](https://huggingface.co/Qwen/Qwen3-1.7B) |
| **Language** | English |
| **License** | [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0) |
| **Technical report** | [MedPsy Technical Report](https://huggingface.co/blog/qvac/medpsy) |
| **Collection** | [MedPsy on Hugging Face](https://huggingface.co/collections/qvac/medpsy) |
| **All MedPsy variants** | [MedPsy-4B](https://huggingface.co/qvac/MedPsy-4B) · [MedPsy-1.7B](https://huggingface.co/qvac/MedPsy-1.7B) · [MedPsy-4B-GGUF](https://huggingface.co/qvac/MedPsy-4B-GGUF) · [MedPsy-1.7B-GGUF](https://huggingface.co/qvac/MedPsy-1.7B-GGUF) |

## Key Highlights

- **Smartphone-class medical AI**: At only 1.7B parameters, small enough to run efficiently on mobile and edge devices
- **Outperforms models 2–16x larger**: Scores **62.62** on closed-ended medical benchmarks, beating MedGemma-1.5-4B (51.20) by +11.42 points and matching Qwen3-4B Thinking (63.10)
- **Beats MedGemma-27B on real-world clinical tasks**: Achieves **70.33** on HealthBench and **54.33** on HealthBench Hard, surpassing MedGemma-27B (65.00 / 42.00), a model 16x larger
- **1.7x token efficiency**: Produces accurate medical answers in ~1,110 tokens vs ~1,901 for Qwen3-1.7B (Thinking), reducing latency and compute cost
- **Privacy-first**: Enables fully on-device inference via the [QVAC SDK](https://qvac.tether.io/dev/sdk/) and [QVAC 
Fabric](https://huggingface.co/blog/qvac/fabric-llm-finetune), patient data never leaves the device.
<p align="center">
  <img src="https://cdn-uploads.huggingface.co/production/uploads/66ad47f5a45133da70d1c40b/buVgcU2vu7sX4ElXOAsw6.png" alt="MedPsy 1.7B: Benchmarks" width="1000">
</p>
## Benchmark Results



<table style="width:100%; border-collapse:collapse; font-size:14px;">
  <thead>
    <tr>
      <th style="padding:10px 14px; text-align:left; border-bottom:2px solid #ddd;"></th>
      <th style="padding:10px 14px; text-align:center; border-bottom:2px solid #ddd; color:#009393; font-weight:bold;">MedPsy-1.7B</th>
      <th style="padding:10px 14px; text-align:center; border-bottom:2px solid #ddd; color:#009393; font-weight:bold;">MedGemma-1.5-4B-it</th>
      <th style="padding:10px 14px; text-align:center; border-bottom:2px solid #ddd; color:#009393; font-weight:bold;">Qwen3-1.7B (Thinking)</th>
      <th style="padding:10px 14px; text-align:center; border-bottom:2px solid #ddd; color:#009393; font-weight:bold;">LFM2.5-1.2B-Thinking</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background:rgba(0,147,147,0.08);"><td colspan="5" style="padding:10px 14px; font-weight:bold; color:#009393; border-bottom:2px solid #009393;">Closed-Ended Medical Benchmarks</td></tr>
    <tr><td style="padding:8px 14px;">Average</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">62.62</td><td style="padding:8px 14px; text-align:center;">51.20</td><td style="padding:8px 14px; text-align:center;">49.95</td><td style="padding:8px 14px; text-align:center;">44.15</td></tr>
    <tr><td style="padding:8px 14px;">MMLU (Health)</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">82.72</td><td style="padding:8px 14px; text-align:center;">67.69</td><td style="padding:8px 14px; text-align:center;">72.49</td><td style="padding:8px 14px; text-align:center;">63.48</td></tr>
    <tr><td style="padding:8px 14px;">AfriMedQA</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">64.84</td><td style="padding:8px 14px; text-align:center;">54.38</td><td style="padding:8px 14px; text-align:center;">51.87</td><td style="padding:8px 14px; text-align:center;">45.07</td></tr>
    <tr><td style="padding:8px 14px;">MMLU-Pro Health</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">61.37</td><td style="padding:8px 14px; text-align:center;">47.31</td><td style="padding:8px 14px; text-align:center;">45.07</td><td style="padding:8px 14px; text-align:center;">37.81</td></tr>
    <tr><td style="padding:8px 14px;">MedMCQA</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">63.56</td><td style="padding:8px 14px; text-align:center;">50.08</td><td style="padding:8px 14px; text-align:center;">49.14</td><td style="padding:8px 14px; text-align:center;">42.11</td></tr>
    <tr><td style="padding:8px 14px;">MedQA (USMLE)</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">75.05</td><td style="padding:8px 14px; text-align:center;">64.39</td><td style="padding:8px 14px; text-align:center;">47.18</td><td style="padding:8px 14px; text-align:center;">39.85</td></tr>
    <tr><td style="padding:8px 14px;">MedXpertQA</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">21.28</td><td style="padding:8px 14px; text-align:center;">15.80</td><td style="padding:8px 14px; text-align:center;">11.60</td><td style="padding:8px 14px; text-align:center;">11.54</td></tr>
    <tr><td style="padding:8px 14px;">PubMedQA</td><td style="padding:8px 14px; text-align:center;">69.53</td><td style="padding:8px 14px; text-align:center;">58.73</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">72.33</td><td style="padding:8px 14px; text-align:center;">69.20</td></tr>
    <tr style="background:rgba(0,147,147,0.08);"><td colspan="5" style="padding:10px 14px; font-weight:bold; color:#009393; border-bottom:2px solid #009393;">HealthBench</td></tr>
    <tr><td style="padding:8px 14px;">Overall</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">70.33</td><td style="padding:8px 14px; text-align:center;">54.00</td><td style="padding:8px 14px; text-align:center;">53.00</td><td style="padding:8px 14px; text-align:center;">49.00</td></tr>
    <tr><td style="padding:8px 14px;">Expertise-Tailored Communication</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">76.33</td><td style="padding:8px 14px; text-align:center;">62.67</td><td style="padding:8px 14px; text-align:center;">63.67</td><td style="padding:8px 14px; text-align:center;">60.00</td></tr>
    <tr><td style="padding:8px 14px;">Response Depth</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">56.33</td><td style="padding:8px 14px; text-align:center;">48.67</td><td style="padding:8px 14px; text-align:center;">49.67</td><td style="padding:8px 14px; text-align:center;">43.00</td></tr>
    <tr><td style="padding:8px 14px;">Context Seeking</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">69.33</td><td style="padding:8px 14px; text-align:center;">46.00</td><td style="padding:8px 14px; text-align:center;">48.33</td><td style="padding:8px 14px; text-align:center;">45.00</td></tr>
    <tr><td style="padding:8px 14px;">Emergency Referrals</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">80.00</td><td style="padding:8px 14px; text-align:center;">64.00</td><td style="padding:8px 14px; text-align:center;">64.67</td><td style="padding:8px 14px; text-align:center;">60.00</td></tr>
    <tr><td style="padding:8px 14px;">Global Health</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">68.33</td><td style="padding:8px 14px; text-align:center;">47.67</td><td style="padding:8px 14px; text-align:center;">45.67</td><td style="padding:8px 14px; text-align:center;">41.33</td></tr>
    <tr><td style="padding:8px 14px;">Health Data Tasks</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">57.00</td><td style="padding:8px 14px; text-align:center;">44.67</td><td style="padding:8px 14px; text-align:center;">42.33</td><td style="padding:8px 14px; text-align:center;">35.33</td></tr>
    <tr><td style="padding:8px 14px;">Responding Under Uncertainty</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">74.00</td><td style="padding:8px 14px; text-align:center;">58.33</td><td style="padding:8px 14px; text-align:center;">56.33</td><td style="padding:8px 14px; text-align:center;">51.00</td></tr>
    <tr style="background:rgba(0,147,147,0.08);"><td colspan="5" style="padding:10px 14px; font-weight:bold; color:#009393; border-bottom:2px solid #009393;">HealthBench Hard</td></tr>
    <tr><td style="padding:8px 14px;">Overall</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">54.33</td><td style="padding:8px 14px; text-align:center;">29.67</td><td style="padding:8px 14px; text-align:center;">28.33</td><td style="padding:8px 14px; text-align:center;">24.67</td></tr>
    <tr><td style="padding:8px 14px;">Expertise-Tailored Communication</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">52.33</td><td style="padding:8px 14px; text-align:center;">31.67</td><td style="padding:8px 14px; text-align:center;">31.67</td><td style="padding:8px 14px; text-align:center;">30.67</td></tr>
    <tr><td style="padding:8px 14px;">Response Depth</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">40.33</td><td style="padding:8px 14px; text-align:center;">29.00</td><td style="padding:8px 14px; text-align:center;">28.33</td><td style="padding:8px 14px; text-align:center;">23.33</td></tr>
    <tr><td style="padding:8px 14px;">Context Seeking</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">61.00</td><td style="padding:8px 14px; text-align:center;">28.00</td><td style="padding:8px 14px; text-align:center;">32.00</td><td style="padding:8px 14px; text-align:center;">27.67</td></tr>
    <tr><td style="padding:8px 14px;">Emergency Referrals</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">60.33</td><td style="padding:8px 14px; text-align:center;">29.00</td><td style="padding:8px 14px; text-align:center;">27.67</td><td style="padding:8px 14px; text-align:center;">22.00</td></tr>
    <tr><td style="padding:8px 14px;">Global Health</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">55.00</td><td style="padding:8px 14px; text-align:center;">29.00</td><td style="padding:8px 14px; text-align:center;">26.67</td><td style="padding:8px 14px; text-align:center;">25.33</td></tr>
    <tr><td style="padding:8px 14px;">Health Data Tasks</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">43.33</td><td style="padding:8px 14px; text-align:center;">23.67</td><td style="padding:8px 14px; text-align:center;">21.33</td><td style="padding:8px 14px; text-align:center;">15.33</td></tr>
    <tr><td style="padding:8px 14px;">Responding Under Uncertainty</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">58.33</td><td style="padding:8px 14px; text-align:center;">35.00</td><td style="padding:8px 14px; text-align:center;">31.00</td><td style="padding:8px 14px; text-align:center;">25.67</td></tr>
  </tbody>
</table>

<p style="font-size:11px; color:#888; margin-top:8px; line-height:1.6;">
* MMLU (Health): averaged accuracy across 6 sub-domains: anatomy, clinical_knowledge, college_biology, college_medicine, medical_genetics, professional_medicine.<br>
* HealthBench evaluated using CompassJudger-2-32B-Instruct as judge.<br>
* All results are averaged over 3 runs with generation parameters: temperature=0.6, top_k=20, top_p=0.95, max_output_tokens=16384.
</p>

## Token Efficiency

Beyond raw accuracy, MedPsy-1.7B achieves a **1.7x reduction** in average response length compared to its base model (Qwen3-1.7B (Thinking)). Shorter responses translate directly to faster inference, lower memory bandwidth usage, and reduced energy consumption - critical for smartphone and low-power edge deployment.

<table style="width:80%; border-collapse:collapse; font-size:14px; margin:auto;">
  <thead>
    <tr>
      <th style="padding:10px 18px; text-align:left; border-bottom:2px solid #ddd;"></th>
      <th style="padding:10px 18px; text-align:center; border-bottom:2px solid #ddd;">Qwen3-1.7B (Thinking)</th>
      <th style="padding:10px 18px; text-align:center; border-bottom:2px solid #ddd; color:#009393; font-weight:bold;">MedPsy-1.7B</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:8px 14px; font-weight:bold;">Avg. Response Length (Tokens)</td>
      <td style="padding:8px 14px; text-align:center;">1,901</td>
      <td style="padding:8px 14px; text-align:center; font-weight:bold;">1,110</td>
    </tr>
    <tr style="background:rgba(0,147,147,0.08); border-top:2px solid #009393;">
      <td style="padding:8px 14px; font-weight:bold; color:#009393;">Δ Reduction</td>
      <td colspan="2" style="padding:8px 14px; text-align:center; font-weight:bold; color:#009393; font-size:16px;">1.7x fewer tokens</td>
    </tr>
  </tbody>
</table>

The chart below shows per-benchmark response lengths. MedPsy-1.7B achieves large reductions on MedQA-USMLE, MedXpertQA, MMLU, and MMLU-Pro Health. On HealthBench, the model generates slightly longer responses than its base, reflecting the richer, more clinically detailed answers that drive its strong HealthBench performance (+17.33 points over base Qwen3-1.7B (Thinking)).

<p align="center">
  <img src="https://cdn-uploads.huggingface.co/production/uploads/66ad47f5a45133da70d1c40b/ei1BFKsXH4KS7lOMeo4uC.png" alt="Average Response Length (Tokens) - 1.7B model class" width="700">
</p>

<p align="center"><em>Average response length (tokens) per benchmark. Lower is better. MedPsy-1.7B produces shorter responses than Qwen3-1.7B (Thinking) on most benchmarks while achieving significantly higher accuracy.</em></p>

## Model Details

| Parameter | Value |
|:---|:---|
| Architecture | Qwen3ForCausalLM |
| Parameters | 1.7B |
| Hidden size | 2,048 |
| FFN hidden size | 6,144 |
| Layers | 28 |
| Attention heads | 16 |
| KV groups (GQA) | 8 |
| Vocab size | 151,936 |
| Max position embeddings | 40,960 |
| Precision | bfloat16 |
| Position embedding | RoPE |
| Normalization | RMSNorm |
| Activation | SwiGLU |

## Usage

### Transformers

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

model_name = "qvac/MedPsy-1.7B"

tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(model_name, torch_dtype="auto", device_map="auto")

messages = [
    {"role": "user", "content": "What are the common symptoms and first-line treatments for community-acquired pneumonia?"}
]

text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
inputs = tokenizer([text], return_tensors="pt").to(model.device)

outputs = model.generate(**inputs, max_new_tokens=1024)
response = tokenizer.decode(outputs[0][inputs.input_ids.shape[-1]:], skip_special_tokens=True)
print(response)
```

## Training

The model was post-trained through a multi-stage pipeline on the Qwen3-1.7B (Thinking) backbone:

1. **SFT Stage 1 (Corpus 1)**: Broad medical adaptation on a large-scale synthetic corpus spanning biology, medicine, and health (including a new health domain not yet publicly released), built from [Genesis II](https://huggingface.co/blog/qvac/genesis-ii)–style medical seeds and open-source medical QA prompts used purely as questions, with all reasoning targets freshly generated by [Baichuan-M3-235B](https://huggingface.co/baichuan-inc/Baichuan-M3-235B).
2. **SFT Stage 2 (Corpus 2)**: Reasoning specialization on a smaller, higher-value clinical QA corpus with teacher-generated chain-of-thought reasoning from Baichuan-M3-235B.
3. **RL Stage 1**: Reinforcement learning (DAPO) on the easy/moderate subset of AlphaMedQA ([Liu et al., 2025](https://arxiv.org/abs/2505.17952)), annotated with the SFT checkpoint.
4. **RL Stage 2**: Focused RL on a hard-enriched AlphaMedQA subset re-annotated with the best Stage 1 checkpoint, targeting persistent failure modes.

For full methodology details, see the [MedPsy Technical Report](https://huggingface.co/blog/qvac/medpsy).


## Use and Limitations

### Intended Use

MedPsy-1.7B is an open language model intended as a **starting point for developers and researchers** building downstream healthcare applications involving medical text. Developers are expected to validate, adapt, and make meaningful modifications to the model for their specific use cases.

Appropriate use cases include:
- Research on medical language understanding and reasoning
- Building developer tools and prototypes for health-related applications
- On-device medical information retrieval for privacy-sensitive environments

Always with appropriate disclaimers.

### Limitations

> [!WARNING]
> This model is **NOT a substitute for professional medical judgment** and the model outputs are **NOT a substitute for proper clinical diagnosis**. Always consult with a certified physician. Despite strong benchmark performance, MedPsy-1.7B is a compact 1.7B-parameter language model, one of the smallest in its class, and **will make errors**. Its small size makes it particularly susceptible to mistakes on complex, multi-step clinical reasoning tasks. Medical AI systems can produce outputs that appear confident and authoritative while being factually incorrect, incomplete, or clinically inappropriate.

**Known limitations include:**

- **Hallucinations**: The model may generate plausible-sounding but incorrect medical information.
- **Compact model trade-offs**: At 1.7B parameters, the model has inherently less capacity than larger models. It may struggle with rare conditions, complex multi-step reasoning, or nuanced clinical scenarios that require deep domain knowledge.
- **English only**: The model was trained and evaluated primarily in English. Performance in other languages is not validated.
- **Text only**: This model processes text inputs only. It cannot interpret medical images, lab results in non-text formats, or other modalities.
- **No real-time knowledge**: The model's knowledge has a training data cutoff and does not reflect the latest medical guidelines, drug approvals, or clinical evidence.
- **Bias in training data**: As with any model trained on synthetic and public medical data, biases in the source material may propagate to model outputs. Developers should validate performance across diverse patient populations, demographics, and clinical contexts.
- **Not designed for emergencies**: This model should never be used as the sole decision-making tool in emergency or life-threatening situations.

### Safety Recommendations

When integrating this model into any application:

1. **Always include visible disclaimers** informing users that outputs are AI-generated and not a substitute for professional medical advice
2. **Do not use for direct clinical diagnosis or treatment** without oversight by qualified healthcare professionals
3. **Monitor for harmful outputs** and implement appropriate safety filters in production systems


## Ethics and Safety

The model was evaluated on medical safety dimensions through the HealthBench evaluation framework, which assesses Emergency Referrals, Responding Under Uncertainty, and Context Seeking, all critical safety dimensions for medical AI. However, no dedicated red-teaming or adversarial safety testing has been conducted on this model to date. Developers deploying this model in production should conduct their own safety evaluations appropriate to their use case.

## Related Resources

- [MedPsy Collection](https://huggingface.co/collections/qvac/medpsy): All MedPsy models, datasets, and resources in one place
- [MedPsy Technical Report](https://huggingface.co/blog/qvac/medpsy): Full methodology and ablation details
- [MedPsy-4B](https://huggingface.co/qvac/MedPsy-4B): Larger sibling model for higher-quality edge deployment
- [MedPsy-1.7B-GGUF](https://huggingface.co/qvac/MedPsy-1.7B-GGUF): Quantized GGUF weights for smartphone-class deployment via llama.cpp / QVAC SDK
- [QVAC SDK](https://qvac.tether.io/dev/sdk/): On-device AI deployment framework
- [QVAC Genesis II](https://huggingface.co/blog/qvac/genesis-ii): Underlying data generation methodology

## Citation

```bibtex
@article{medpsy2026,
  title={MedPsy: State-of-the-Art Medical and Healthcare Language Models for Edge Devices},
  author={Vitabile, Davide and Buffa, Alexandro and Nambiar, Akshay and Nazir, Amril},
  year={2026},
  url={https://huggingface.co/blog/qvac/medpsy}
  institution={Tether AI Research}
}
```

## Copyright

We will take appropriate actions in response to notices of copyright infringement. If you believe your work has been used or copied in a manner that infringes upon your intellectual property rights, please email [data-apps@tether.io](mailto:data-apps@tether.io) identifying and describing both the copyrighted work and alleged infringing content.

## Licensing

This model, which was trained as described in the [MedPsy Technical Report](https://huggingface.co/blog/qvac/medpsy), is licensed by Tether Data, S.A. de C.V. under the [Apache 2.0 license](https://huggingface.co/datasets/choosealicense/licenses/blob/main/markdown/apache-2.0.md) for research and educational purposes. As described above, this model is a version of [Qwen3-1.7B](https://huggingface.co/Qwen/Qwen3-1.7B), which is also available under the [Apache 2.0 license](https://huggingface.co/datasets/choosealicense/licenses/blob/main/markdown/apache-2.0.md).

As described above, a subset of the Genesis I and Genesis II datasets was used by the [Baichuan-M3-235B](https://huggingface.co/baichuan-inc/Baichuan-M3-235B) model, which itself is also available under the [Apache 2.0 license](https://huggingface.co/datasets/choosealicense/licenses/blob/main/markdown/apache-2.0.md) to generate synthetic data for training this model. The [Genesis I](https://huggingface.co/datasets/qvac/GenesisI) dataset is made available under the [CC-BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/legalcode.en) (Creative Commons Attribution-NonCommercial 4.0) license. The [Genesis II](https://huggingface.co/datasets/qvac/GenesisII) dataset is also made available under the [CC-BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/legalcode.en) license.