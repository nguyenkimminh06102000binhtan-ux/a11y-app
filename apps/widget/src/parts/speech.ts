/*
 * The voice behind Read aloud. An engine speaks one piece of text at a time; the player (read-aloud.ts) doesn't
 * know which engine it uses, so natural cloud voices can be added later (a paid option) as another engine.
 *
 * The browser's own speech (speechSynthesis): free, no setup.
 * - A voice for the text's language; on-device voices first, because some browsers' network voices (e.g. Chrome's
 *   "Google" ones) send the text to their maker. A network voice only when the device has none for the language.
 * - One sentence per call: Chrome stops long utterances after about 15 seconds.
 */

export type Engine = {
    supported: boolean;
    /** Speak `text`; `done` runs when it finishes (not when cancelled). */
    speak(text: string, options: { lang: string; rate: number }, done: () => void): void;
    pause(): void;
    resume(): void;
    cancel(): void;
};

export function browserEngine(): Engine {
    const synth = typeof window.speechSynthesis?.speak === "function" ? window.speechSynthesis : null;

    function voiceFor(lang: string): SpeechSynthesisVoice | undefined {
        const wanted = lang.toLowerCase().replace("_", "-");
        const base = wanted.split("-")[0];
        const voices = synth?.getVoices() ?? [];
        const norm = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace("_", "-");
        const exact = voices.filter((v) => norm(v) === wanted);
        const sameLanguage = voices.filter((v) => norm(v).split("-")[0] === base);
        return exact.find((v) => v.localService) ?? sameLanguage.find((v) => v.localService) ?? exact[0] ?? sameLanguage[0];
    }

    return {
        supported: !!synth,
        speak(text, { lang, rate }, done) {
            if (!synth) return;
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = lang;
            utterance.rate = rate;
            const voice = voiceFor(lang);
            if (voice) utterance.voice = voice;
            utterance.onend = () => done();
            utterance.onerror = (e) => {
                if (e.error !== "interrupted" && e.error !== "canceled") done(); // a failed sentence: go on
            };
            synth.speak(utterance);
        },
        pause: () => synth?.pause(),
        resume: () => synth?.resume(),
        cancel: () => synth?.cancel(),
    };
}
