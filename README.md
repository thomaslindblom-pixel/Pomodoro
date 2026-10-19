# Pomodoro

En enkel Pomodoro-app för iPhone (webbapp/PWA som läggs till på hemskärmen).

- Fokuspass: 25 minuter
- Kort paus: 5 minuter
- Efter tre arbetspass: lång paus på 25 minuter
- Sedan börjar en ny cykel om tre arbetspass

## Installera på iPhone

1. Publicera mappen med GitHub Pages: *Settings → Pages → Deploy from a branch*,
   välj branchen och mappen `/ (root)`.
2. Öppna sidans adress i **Safari** på iPhonen.
3. Tryck på dela-knappen → **Lägg till på hemskärmen**.

Appen startar då i helskärm som en vanlig app och fungerar även offline.

## Bra att veta

- Timern bygger på klockslag, så den håller rätt tid även om du byter app eller
  låser skärmen. När du öppnar appen igen har den räknat fram rätt pass.
- Ljudsignalen spelas bara när appen är öppen (iOS tillåter inte att
  webbappar spelar ljud i bakgrunden). Skärmen hålls tänd medan timern går,
  där iOS stöder det.
- **Hoppa** går till nästa pass, **Nollställ** börjar om från första arbetspasset.
