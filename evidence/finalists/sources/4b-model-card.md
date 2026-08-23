---
language:
- en
license: apache-2.0
license_link: https://huggingface.co/qvac/MedPsy-4B/blob/main/LICENSE
library_name: transformers
base_model:
- Qwen/Qwen3-4B-Thinking-2507
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

# MedPsy-4B

**MedPsy-4B** is a state-of-the-art, text-only medical and healthcare language model purpose-built for edge deployment. Built on top of Qwen3-4B-Thinking-2507 and post-trained with a multi-stage pipeline (supervised fine-tuning + reinforcement learning) on curated medical data, it surpasses models nearly 7x its size on medical benchmarks.

| | |
|:---|:---|
| **Developed by** | [Tether AI Research](https://tether.io/) |
| **Model type** | Text-only causal language model (decoder-only transformer) |
| **Base model** | [Qwen3-4B-Thinking-2507](https://huggingface.co/Qwen/Qwen3-4B-Thinking-2507) |
| **Language** | English |
| **License** | [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0) |
| **Technical report** | [MedPsy Technical Report](https://huggingface.co/blog/qvac/medpsy) |
| **Collection** | [MedPsy on Hugging Face](https://huggingface.co/collections/qvac/medpsy) |
| **All MedPsy variants** | [MedPsy-4B](https://huggingface.co/qvac/MedPsy-4B) · [MedPsy-1.7B](https://huggingface.co/qvac/MedPsy-1.7B) · [MedPsy-4B-GGUF](https://huggingface.co/qvac/MedPsy-4B-GGUF) · [MedPsy-1.7B-GGUF](https://huggingface.co/qvac/MedPsy-1.7B-GGUF) |

## Key Highlights

- **Surpasses 27B models at 4B scale**: Scores **70.54** on closed-ended medical benchmarks, outperforming MedGemma-27B-text-it (69.95) despite being nearly 7x smaller
- **Real-world clinical strength**: Achieves **74.00** on HealthBench and **58.00** on HealthBench Hard, beating MedGemma-27B (65.00 / 42.00) by +9.00 and +16.00 points
- **3.2x token efficiency**: Produces accurate medical answers in ~909 tokens vs ~2,953 for Qwen3-4B Thinking, reducing latency and compute cost
- **Privacy-first**: Enables fully on-device inference via the [QVAC SDK](https://qvac.tether.io/dev/sdk/) and [QVAC 
Fabric](https://huggingface.co/blog/qvac/fabric-llm-finetune), patient data never leaves the device.
<p align="center">
  <img src="https://cdn-uploads.huggingface.co/production/uploads/66ad47f5a45133da70d1c40b/F-8t5tIM8oSqVrOXWNl2F.png" alt="MedPsy 4B: Benchmarks" width="1000">
</p>
## Benchmark Results



<table style="width:100%; border-collapse:collapse; font-size:14px;">
  <thead>
    <tr>
      <th style="padding:10px 14px; text-align:left; border-bottom:2px solid #ddd;"></th>
      <th style="padding:10px 14px; text-align:center; border-bottom:2px solid #ddd; color:#009393; font-weight:bold;">MedPsy-4B</th>
      <th style="padding:10px 14px; text-align:center; border-bottom:2px solid #ddd; color:#009393; font-weight:bold;">MedGemma-27B-text-it</th>
      <th style="padding:10px 14px; text-align:center; border-bottom:2px solid #ddd; color:#009393; font-weight:bold;">Qwen3-4B-Thinking-2507</th>
      <th style="padding:10px 14px; text-align:center; border-bottom:2px solid #ddd; color:#009393; font-weight:bold;">MedGemma-1.5-4B-it</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background:rgba(0,147,147,0.08);"><td colspan="5" style="padding:10px 14px; font-weight:bold; color:#009393; border-bottom:2px solid #009393;">Closed-Ended Medical Benchmarks</td></tr>
    <tr><td style="padding:8px 14px;">Average</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">70.54</td><td style="padding:8px 14px; text-align:center;">69.95</td><td style="padding:8px 14px; text-align:center;">63.10</td><td style="padding:8px 14px; text-align:center;">51.20</td></tr>
    <tr><td style="padding:8px 14px;">MMLU (Health)</td><td style="padding:8px 14px; text-align:center;">89.70</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">90.48</td><td style="padding:8px 14px; text-align:center;">85.92</td><td style="padding:8px 14px; text-align:center;">67.69</td></tr>
    <tr><td style="padding:8px 14px;">AfriMedQA</td><td style="padding:8px 14px; text-align:center;">71.50</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">73.07</td><td style="padding:8px 14px; text-align:center;">64.12</td><td style="padding:8px 14px; text-align:center;">54.38</td></tr>
    <tr><td style="padding:8px 14px;">MMLU-Pro Health</td><td style="padding:8px 14px; text-align:center;">70.45</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">72.94</td><td style="padding:8px 14px; text-align:center;">67.73</td><td style="padding:8px 14px; text-align:center;">47.31</td></tr>
    <tr><td style="padding:8px 14px;">MedMCQA</td><td style="padding:8px 14px; text-align:center;">72.15</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">72.77</td><td style="padding:8px 14px; text-align:center;">61.78</td><td style="padding:8px 14px; text-align:center;">50.08</td></tr>
    <tr><td style="padding:8px 14px;">MedQA (USMLE)</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">84.39</td><td style="padding:8px 14px; text-align:center;">83.29</td><td style="padding:8px 14px; text-align:center;">70.91</td><td style="padding:8px 14px; text-align:center;">64.39</td></tr>
    <tr><td style="padding:8px 14px;">MedXpertQA</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">30.61</td><td style="padding:8px 14px; text-align:center;">25.18</td><td style="padding:8px 14px; text-align:center;">16.69</td><td style="padding:8px 14px; text-align:center;">15.80</td></tr>
    <tr><td style="padding:8px 14px;">PubMedQA</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">75.00</td><td style="padding:8px 14px; text-align:center;">71.93</td><td style="padding:8px 14px; text-align:center;">74.53</td><td style="padding:8px 14px; text-align:center;">58.73</td></tr>
    <tr style="background:rgba(0,147,147,0.08);"><td colspan="5" style="padding:10px 14px; font-weight:bold; color:#009393; border-bottom:2px solid #009393;">HealthBench</td></tr>
    <tr><td style="padding:8px 14px;">Overall</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">74.00</td><td style="padding:8px 14px; text-align:center;">65.00</td><td style="padding:8px 14px; text-align:center;">63.00</td><td style="padding:8px 14px; text-align:center;">54.00</td></tr>
    <tr><td style="padding:8px 14px;">Expertise-Tailored Communication</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">79.33</td><td style="padding:8px 14px; text-align:center;">73.00</td><td style="padding:8px 14px; text-align:center;">71.00</td><td style="padding:8px 14px; text-align:center;">62.67</td></tr>
    <tr><td style="padding:8px 14px;">Response Depth</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">63.67</td><td style="padding:8px 14px; text-align:center;">61.33</td><td style="padding:8px 14px; text-align:center;">58.00</td><td style="padding:8px 14px; text-align:center;">48.67</td></tr>
    <tr><td style="padding:8px 14px;">Context Seeking</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">71.67</td><td style="padding:8px 14px; text-align:center;">58.67</td><td style="padding:8px 14px; text-align:center;">57.67</td><td style="padding:8px 14px; text-align:center;">46.00</td></tr>
    <tr><td style="padding:8px 14px;">Emergency Referrals</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">81.67</td><td style="padding:8px 14px; text-align:center;">73.00</td><td style="padding:8px 14px; text-align:center;">74.00</td><td style="padding:8px 14px; text-align:center;">64.00</td></tr>
    <tr><td style="padding:8px 14px;">Global Health</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">73.67</td><td style="padding:8px 14px; text-align:center;">61.00</td><td style="padding:8px 14px; text-align:center;">59.00</td><td style="padding:8px 14px; text-align:center;">47.67</td></tr>
    <tr><td style="padding:8px 14px;">Health Data Tasks</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">60.67</td><td style="padding:8px 14px; text-align:center;">56.67</td><td style="padding:8px 14px; text-align:center;">54.67</td><td style="padding:8px 14px; text-align:center;">44.67</td></tr>
    <tr><td style="padding:8px 14px;">Responding Under Uncertainty</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">76.33</td><td style="padding:8px 14px; text-align:center;">66.33</td><td style="padding:8px 14px; text-align:center;">64.33</td><td style="padding:8px 14px; text-align:center;">58.33</td></tr>
    <tr style="background:rgba(0,147,147,0.08);"><td colspan="5" style="padding:10px 14px; font-weight:bold; color:#009393; border-bottom:2px solid #009393;">HealthBench Hard</td></tr>
    <tr><td style="padding:8px 14px;">Overall</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">58.00</td><td style="padding:8px 14px; text-align:center;">42.00</td><td style="padding:8px 14px; text-align:center;">42.67</td><td style="padding:8px 14px; text-align:center;">29.67</td></tr>
    <tr><td style="padding:8px 14px;">Expertise-Tailored Communication</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">55.33</td><td style="padding:8px 14px; text-align:center;">44.67</td><td style="padding:8px 14px; text-align:center;">45.00</td><td style="padding:8px 14px; text-align:center;">31.67</td></tr>
    <tr><td style="padding:8px 14px;">Response Depth</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">47.67</td><td style="padding:8px 14px; text-align:center;">38.67</td><td style="padding:8px 14px; text-align:center;">38.67</td><td style="padding:8px 14px; text-align:center;">29.00</td></tr>
    <tr><td style="padding:8px 14px;">Context Seeking</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">63.33</td><td style="padding:8px 14px; text-align:center;">42.00</td><td style="padding:8px 14px; text-align:center;">43.00</td><td style="padding:8px 14px; text-align:center;">28.00</td></tr>
    <tr><td style="padding:8px 14px;">Emergency Referrals</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">62.33</td><td style="padding:8px 14px; text-align:center;">39.67</td><td style="padding:8px 14px; text-align:center;">47.33</td><td style="padding:8px 14px; text-align:center;">29.00</td></tr>
    <tr><td style="padding:8px 14px;">Global Health</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">60.00</td><td style="padding:8px 14px; text-align:center;">42.67</td><td style="padding:8px 14px; text-align:center;">43.33</td><td style="padding:8px 14px; text-align:center;">29.00</td></tr>
    <tr><td style="padding:8px 14px;">Health Data Tasks</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">46.67</td><td style="padding:8px 14px; text-align:center;">39.33</td><td style="padding:8px 14px; text-align:center;">39.67</td><td style="padding:8px 14px; text-align:center;">23.67</td></tr>
    <tr><td style="padding:8px 14px;">Responding Under Uncertainty</td><td style="padding:8px 14px; text-align:center; font-weight:bold;">61.00</td><td style="padding:8px 14px; text-align:center;">42.67</td><td style="padding:8px 14px; text-align:center;">42.00</td><td style="padding:8px 14px; text-align:center;">35.00</td></tr>
  </tbody>
</table>

<p style="font-size:11px; color:#888; margin-top:8px; line-height:1.6;">
* MMLU (Health): averaged accuracy across 6 sub-domains: anatomy, clinical_knowledge, college_biology, college_medicine, medical_genetics, professional_medicine.<br>
* HealthBench evaluated using CompassJudger-2-32B-Instruct as judge.<br>
* All results are averaged over 3 runs with generation parameters: temperature=0.6, top_k=20, top_p=0.95, max_output_tokens=16384.
</p>

## Token Efficiency

Beyond raw accuracy, MedPsy-4B achieves a **3.2x reduction** in average response length compared to its backbone model (Qwen3-4B-Thinking-2507). This means faster inference, lower compute costs, and reduced latency - critical for real-time clinical decision support on edge devices.

<table style="width:80%; border-collapse:collapse; font-size:14px; margin:auto;">
  <thead>
    <tr>
      <th style="padding:10px 18px; text-align:left; border-bottom:2px solid #ddd;"></th>
      <th style="padding:10px 18px; text-align:center; border-bottom:2px solid #ddd;">Qwen3-4B-Thinking-2507</th>
      <th style="padding:10px 18px; text-align:center; border-bottom:2px solid #ddd; color:#009393; font-weight:bold;">MedPsy-4B</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:8px 14px; font-weight:bold;">Avg. Response Length (Tokens)</td>
      <td style="padding:8px 14px; text-align:center;">2,953</td>
      <td style="padding:8px 14px; text-align:center; font-weight:bold;">909</td>
    </tr>
    <tr style="background:rgba(0,147,147,0.08); border-top:2px solid #009393;">
      <td style="padding:8px 14px; font-weight:bold; color:#009393;">Δ Reduction</td>
      <td colspan="2" style="padding:8px 14px; text-align:center; font-weight:bold; color:#009393; font-size:16px;">3.2x fewer tokens</td>
    </tr>
  </tbody>
</table>

The chart below shows per-benchmark response lengths. The largest reductions appear on reasoning-intensive tasks (MedXpertQA, MedQA-USMLE, MMLU-Pro Health), where the base model's extended thinking produces substantially longer outputs without accuracy gains over our post-trained model.

<p align="center">
  <img src="https://cdn-uploads.huggingface.co/production/uploads/66ad47f5a45133da70d1c40b/MFVmKNNxen-axlV06TnTY.png" alt="Average Response Length (Tokens) - 4B model class" width="700">
</p>

<p align="center"><em>Average response length (tokens) per benchmark. Lower is better. MedPsy-4B consistently produces shorter responses than Qwen3-4B-Thinking-2507 while achieving higher overall accuracy.</em></p>

## Model Details

| Parameter | Value |
|:---|:---|
| Architecture | Qwen3ForCausalLM |
| Parameters | 4B |
| Hidden size | 2,560 |
| FFN hidden size | 9,728 |
| Layers | 36 |
| Attention heads | 32 |
| KV groups (GQA) | 8 |
| Vocab size | 151,936 |
| Max position embeddings | 262,144 |
| Precision | bfloat16 |
| Position embedding | RoPE |
| Normalization | RMSNorm |
| Activation | SwiGLU |

## Usage

### Transformers

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

model_name = "qvac/MedPsy-4B"

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

The model was post-trained through a multi-stage pipeline on the Qwen3-4B-Thinking-2507 backbone:

1. **SFT Stage 1 (Corpus 1)**: Broad medical adaptation on a large-scale synthetic corpus spanning biology, medicine, and health (including a new health domain not yet publicly released), built from [Genesis II](https://huggingface.co/blog/qvac/genesis-ii)–style medical seeds and open-source medical QA prompts used purely as questions, with all reasoning targets freshly generated by [Baichuan-M3-235B](https://huggingface.co/baichuan-inc/Baichuan-M3-235B).
2. **SFT Stage 2 (Corpus 2)**: Reasoning specialization on a smaller, higher-value clinical QA corpus with teacher-generated chain-of-thought reasoning from Baichuan-M3-235B.
3. **RL Stage 1**: Reinforcement learning (DAPO) on the easy/moderate subset of AlphaMedQA ([Liu et al., 2025](https://arxiv.org/abs/2505.17952)), annotated with the SFT checkpoint.
4. **RL Stage 2**: Focused RL on a hard-enriched AlphaMedQA subset re-annotated with the best Stage 1 checkpoint, targeting persistent failure modes.

For full methodology details, see the [MedPsy Technical Report](https://huggingface.co/blog/qvac/medpsy).


## Use and Limitations

### Intended Use

MedPsy-4B is an open language model intended as a **starting point for developers and researchers** building downstream healthcare applications involving medical text. Developers are expected to validate, adapt, and make meaningful modifications to the model for their specific use cases.

Appropriate use cases include:
- Research on medical language understanding and reasoning
- Building developer tools and prototypes for health-related applications
- On-device medical information retrieval for privacy-sensitive environments

Always with appropriate disclaimers.

### Limitations

> [!WARNING]
> This model is **NOT a substitute for professional medical judgment** and the model outputs are **NOT a substitute for proper clinical diagnosis**. Always consult with a certified physician. Despite strong benchmark performance, MedPsy-4B is a compact 4B-parameter language model that **will make errors**. Medical AI systems can produce outputs that appear confident and authoritative while being factually incorrect, incomplete, or clinically inappropriate.

**Known limitations include:**

- **Hallucinations**: The model may generate plausible-sounding but incorrect medical information.
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
- [MedPsy-1.7B](https://huggingface.co/qvac/MedPsy-1.7B): Smaller sibling model for smartphone-class deployment
- [MedPsy-4B-GGUF](https://huggingface.co/qvac/MedPsy-4B-GGUF): Quantized GGUF weights for on-device inference via llama.cpp / QVAC SDK
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

This model, which was trained as described in the [MedPsy Technical Report](https://huggingface.co/blog/qvac/medpsy), is licensed by Tether Data, S.A. de C.V. under the [Apache 2.0 license](https://huggingface.co/datasets/choosealicense/licenses/blob/main/markdown/apache-2.0.md) for research and educational purposes. As described above, this model is a version of [Qwen3-4B-Thinking-2507](https://huggingface.co/Qwen/Qwen3-4B-Thinking-2507), which is also under the [Apache 2.0 license](https://huggingface.co/datasets/choosealicense/licenses/blob/main/markdown/apache-2.0.md).

As described above, a subset of the Genesis I and Genesis II datasets was used by the [Baichuan-M3-235B](https://huggingface.co/baichuan-inc/Baichuan-M3-235B) model—which itself is also available under the [Apache 2.0 license](https://huggingface.co/datasets/choosealicense/licenses/blob/main/markdown/apache-2.0.md) to generate synthetic data for training this model. The [Genesis I](https://huggingface.co/datasets/qvac/GenesisI) dataset is made available under the [CC-BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/legalcode.en) (Creative Commons Attribution-NonCommercial 4.0) license. The [Genesis II](https://huggingface.co/datasets/qvac/GenesisII) dataset is also made available under the [CC-BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/legalcode.en) license.
