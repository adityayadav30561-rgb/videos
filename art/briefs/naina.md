# Brief: naina (lyric film), look stage

| | |
|---|---|
| Kind | a kinetic lyric film for a Hindi song, after the person's reference video (a saffron card on teal; each lyric becomes a picture that morphs into the next) |
| Style | **Oil on canvas** (user) |
| Text | Hindi, Devanagari (user): Yatra One for big glossy words, Kalam for lyric lines (fonts bundled, OFL, see assets/fonts/PROVENANCE.md) |
| Shape | vertical 9:16, 1080 x 1920 (user); every design re-laid for the tall card |
| Sound | the person's own song file (user), to come; the film is cut to its beats |
| Script | to come from the person |
| fps | 12, the reference's hand-made rate (mine, from the reference; to confirm) |

## Look frames (stills/naina-look/), the reference's own images as stand-ins until the script arrives
1. Title, glossy "तेरे नैना" with sparkles. 2. "ज़ख़्म": the wound. 3. "मरहम": plaster over it, an eye opening in it.
4. "फूल पे शबनम": a red lily with a dew drop. 5. "जग": the world as the iris of a great eye. 6. "तारे भी शरमाएँ": two blushing stars.

## Round 2 (user): the flow as written by the person; palette changed; style stays oil
- Palette (user: "Rose & indigo"): blush-rose wedding card, deeper-rose mandala, indigo border with a halftone; objects crimson, gold, turquoise. Hook words: बल्लाह gold on crimson, तेरे नैना turquoise on indigo.
- Flow (user, verbatim intent): बल्लाह zooms in, holds, squashes flat into a red wound → मरहम: a band-aid slides over, its centre line opens into an eye → तेरे नैना: the eye bleeds into a red lily, the lily's eye closes to leave one dewdrop (शबनम) → जग: the lily fades behind a dark disc that becomes the globe, the globe becomes the iris of an eye → दिल छूलें: one curved line draws on and closes into a heart, which fills red → two eyes, irises drop out, the eyes become two blushing stars (तारे भी शरमाएँ) → a striped curtain sweeps in from the corners, sargam syllables (पा … सा) pop on the empty stage.
- Feel (user): playful, romantic, literal; 12 fps, steppy; something changes about every half second; lines draw on, fills land solid, hook lettering pops with squash-and-stretch. Hook words stay on screen; lyric lines word by word with the singing, sometimes curving round an object.
- Frames (stills/naina-frames/), mostly mid-transition: 1 बल्लाह pops; 2 बल्लाह squashing into the wound; 3 band-aid, centre line half open into an eye; 4 eye bleeding into the lily being drawn; 5 globe with the words round it, the eye being drawn round it; 6 the line closing into a heart, the fill landing; 7 blushing stars, the curtain sweeping in.

## The film (art/src/canvas-core/naina.ts)
- 229 frames, 12 fps, 1080 x 1920, 19.08 s. Cues are the reference video's own event frames (already cut to the song); the song's measured onsets agree (zakhm 39, band-aid 45, eye 55-57, phool pe 68, shabnam 76, jag 99, eye 113, dil 130, two eyes 144, taare 174-179, curtain 189, sargam 194+).
- Transitions, each a picture becoming the next: बल्लाह zoom, hold, squash into the wound; band-aid slides in, its line opens into an eye, falls away; the wound's line curls into the lily's outline; the eye bleeds red into the lily; the eye closes, leaving a dewdrop that falls to a petal; the drop swells into a dark disc eclipsing the lily and lands its continents as the world; an eye is drawn round the world; it blinks shut, its lower lid left as a smile that curls into a heart; the heart splits into two eyes; their irises fall out, the eyes close and pop as blushing stars; a dive into the stars; the striped curtain sweeps back to the corners; sargam syllables pop one per beat, ending on सा.
- Audio: the song is muxed in after rendering (ffmpeg), from a local copy only; it is never committed to the repository.
