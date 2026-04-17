import type { AnyModel, Provider } from './types'
import { stubProvider } from './stub'

/**
 * Add new providers here. Each one is self-contained in its own folder and
 * registers a handful of models. Keep the array order — it drives the
 * new-tab picker.
 */
export const providers: Provider[] = [stubProvider]

export function allModels(): AnyModel[] {
  return providers.flatMap((p) => p.models)
}

export function getModel(id: string): AnyModel | undefined {
  return allModels().find((m) => m.id === id)
}

export function getProvider(id: string): Provider | undefined {
  return providers.find((p) => p.id === id)
}
