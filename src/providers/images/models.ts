export type ImageModelType = 'text-to-image' | 'image-to-image'

export interface ImageModel {
  model_name: string
  model_type: ImageModelType
  fal_endpoint: string
}

export const imageModels: ImageModel[] = [
  {
    model_name: 'Nano Banana 2',
    model_type: 'text-to-image',
    fal_endpoint: 'fal-ai/nano-banana-2',
  },
  {
    model_name: 'GPT Image 1.5',
    model_type: 'text-to-image',
    fal_endpoint: 'fal-ai/gpt-image-1.5',
  },
  {
    model_name: 'Z-Image Turbo',
    model_type: 'text-to-image',
    fal_endpoint: 'fal-ai/z-image/turbo',
  },
  {
    model_name: 'Ideogram V3',
    model_type: 'text-to-image',
    fal_endpoint: 'fal-ai/ideogram/v3',
  },
  {
    model_name: 'Seedream V5 Lite',
    model_type: 'text-to-image',
    fal_endpoint: 'fal-ai/bytedance/seedream/v5/lite/text-to-image',
  },
]

export function getImageModel(model_name: string): ImageModel | undefined {
  return imageModels.find((m) => m.model_name === model_name)
}
