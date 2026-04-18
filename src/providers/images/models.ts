export type ImageModelType = 'text-to-image' | 'image-to-image'

export interface ImageModel {
  model_name: string
  model_type: ImageModelType
  fal_endpoint: string
  fal_edit_endpoint?: string
  support_edit: boolean
}

export const imageModels: ImageModel[] = [
  {
    model_name: 'Nano Banana 2',
    model_type: 'text-to-image',
    fal_endpoint: 'fal-ai/nano-banana-2',
    fal_edit_endpoint: 'fal-ai/nano-banana-2/edit',
    support_edit: true,
  },
  {
    model_name: 'GPT Image 1.5',
    model_type: 'text-to-image',
    fal_endpoint: 'fal-ai/gpt-image-1.5',
    fal_edit_endpoint: 'fal-ai/gpt-image-1.5/edit',
    support_edit: true,
  },
  {
    model_name: 'Z-Image Turbo',
    model_type: 'text-to-image',
    fal_endpoint: 'fal-ai/z-image/turbo',
    support_edit: false,
  },
  {
    model_name: 'Ideogram V3',
    model_type: 'text-to-image',
    fal_endpoint: 'fal-ai/ideogram/v3',
    support_edit: false,
  },
  {
    model_name: 'Seedream V5 Lite',
    model_type: 'text-to-image',
    fal_endpoint: 'fal-ai/bytedance/seedream/v5/lite/text-to-image',
    fal_edit_endpoint: 'fal-ai/bytedance/seedream/v5/lite/edit',
    support_edit: true,
  },
  {
    model_name: 'FLUX 2 Pro',
    model_type: 'text-to-image',
    fal_endpoint: 'fal-ai/flux-2-pro',
    support_edit: false,
  },
  {
    model_name: 'FLUX 2',
    model_type: 'text-to-image',
    fal_endpoint: 'fal-ai/flux-2',
    support_edit: false,
  },
  {
    model_name: 'Grok Imagine',
    model_type: 'image-to-image',
    fal_endpoint: 'xai/grok-imagine-image',
    support_edit: true,
  },
  {
    model_name: 'Ernie Image Turbo',
    model_type: 'text-to-image',
    fal_endpoint: 'fal-ai/ernie-image/turbo',
    support_edit: false,
  },
  {
    model_name: 'Recraft V3',
    model_type: 'text-to-image',
    fal_endpoint: 'fal-ai/recraft/v3/text-to-image',
    support_edit: false,
  },
  {
    model_name: 'Qwen Image 2 Pro',
    model_type: 'text-to-image',
    fal_endpoint: 'fal-ai/qwen-image-2/pro/text-to-image',
    fal_edit_endpoint: 'fal-ai/qwen-image-2/pro/edit',
    support_edit: true,
  },
  {
    model_name: 'Wan 2.7',
    model_type: 'text-to-image',
    fal_endpoint: 'fal-ai/wan/v2.7/text-to-image',
    fal_edit_endpoint: 'fal-ai/wan/v2.7/edit',
    support_edit: true,
  },
  {
    model_name: 'Qwen Image',
    model_type: 'text-to-image',
    fal_endpoint: 'fal-ai/qwen-image',
    fal_edit_endpoint: 'fal-ai/qwen-image-edit',
    support_edit: true,
  },
  {
    model_name: 'Seedream V4.5',
    model_type: 'text-to-image',
    fal_endpoint: 'fal-ai/bytedance/seedream/v4.5/text-to-image',
    fal_edit_endpoint: 'fal-ai/bytedance/seedream/v4.5/edit',
    support_edit: true,
  },
  {
    model_name: 'FLUX Pro Kontext Max',
    model_type: 'text-to-image',
    fal_endpoint: 'fal-ai/flux-pro/kontext/max',
    support_edit: false,
  },
]

export function getImageModel(model_name: string): ImageModel | undefined {
  return imageModels.find((m) => m.model_name === model_name)
}
