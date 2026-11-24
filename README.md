# deAPI Images for SillyTavern

Generate images in [SillyTavern](https://github.com/SillyTavern/SillyTavern) chats with [deAPI](https://deapi.ai). SillyTavern's built-in OpenAI image source always calls api.openai.com, so this extension talks to deAPI's OpenAI-compatible endpoint directly.

## Install

1. In SillyTavern open **Extensions → Install extension** and paste:
   `https://github.com/deapi-ai/SillyTavern-deAPI`
2. Open **Extensions → deAPI Images**, paste your key from [app.deapi.ai/settings/api-keys](https://app.deapi.ai/settings/api-keys) and click **Test key**.

## Use

- `/deapi-image a castle at dusk`: posts the image to the chat. The command returns the image URL, so it also works in STscript.
- Wand menu → **deAPI image**: asks for a prompt, prefilled with the last message.

| Setting | Default | Notes |
| --- | --- | --- |
| Model | `ZImageTurbo_INT8` | Also `Flux1schnell`, `Flux_2_Klein_4B_BF16`, `ZAnimeDistill_8Step_INT8` |
| Size | `512x512` | `ZImageTurbo_INT8` and `ZAnimeDistill_8Step_INT8` take 512, 768 or 1024 square. `Flux1schnell` also takes 1024x1536 and 1536x1024. |
| Prompt prefix | empty | Added before every prompt, e.g. a style |

## Notes

- deAPI filters NSFW prompts. A rejected prompt shows an error toast, not an image.
- The key is stored in your SillyTavern settings and is sent only to `oai.deapi.ai`. Requests carry an `X-Deapi-Source: sillytavern` header so deAPI can see traffic from this extension. Nothing about you or your chats is added.
- Images are saved under SillyTavern's user images, like those from the built-in Image Generation extension.

## Text-to-speech

No extension is needed. In **Extensions → TTS**, choose **OpenAI Compatible**, set **Provider Endpoint** to `https://oai.deapi.ai/v1/audio/speech`, **Model** to `Kokoro`, **Available Voices** to e.g. `af_nova,af_bella,am_adam`, and save your deAPI key with the key button.

## License

MIT
