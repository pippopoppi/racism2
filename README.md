# Racism 2 — Super Slot Racing 🏁

Gioco di corse slot car per browser, gratis e senza installare nulla.
**Gioca:** https://pippopoppi.github.io/racism2/

Il seguito di Slotcars Simulator, rifatto da zero: fisica più onesta, grafica nuova,
motore da supercar sintetizzato in tempo reale e avversari IA.

## Novità rispetto alla versione 1

- **Niente più deragliamenti ingiusti.** La macchina non vola via appena superi il limite:
  prima scivola (fumo, stridio, striscia sull'asfalto), lo schermo si tinge di rosso e compare
  l'avviso *TROPPO VELOCE!*. Deragli solo se insisti o entri in curva molto troppo forte.
- **Un solo comando, come un vero slot car:** tieni il GAS, rilascia prima delle curve e
  l'auto rallenta da sola. In più **TURBO ⚡** con 3 cariche a gara.
- **Linea di gara sul tracciato:** davanti alla macchina la corsia si colora di giallo
  ("dovrai frenare") o rosso ("frena ADESSO").
- **Motore da supercar** via Web Audio: 6 marce con cambiata, scarico, fischio del turbo,
  stridio delle gomme, botto al deragliamento, semaforo F1 e fanfara d'arrivo.
- **5 circuiti con ambienti diversi:** ovale nel deserto rosso, autodromo con tribune,
  riviera sul mare, cittadino di notte al neon, tornanti alpini sulla neve (grip ridotto).
- **Tutto il circuito sempre in vista** (come in un vero slot car) con la tua auto evidenziata,
  così sai in anticipo quando accelerare. Con 🗺️/🎥 si passa alla telecamera che insegue l'auto.
- **Multiplayer locale da 2 a 4 piloti** sullo stesso schermo, in stile V1: ogni pilota ha il suo
  blocco GAS / TURBO colorato in basso e la sua riga di stato in alto. Con `IA` le corsie libere
  le prendono le IA, con `NO IA` in pista ci siete solo voi. Niente server.
- **3 avversari IA** con nomi e abilità diverse, classifica live, minimappa, giri 1/3/5.
- Cordoli, tribune, cartelloni, barriere di pneumatici, lampioni, fari di notte, particelle e
  segni di gomma persistenti.
- **Velocità ×1 / ×2 / ×3** dal menu (default ×3): tutto scala in modo coerente, i punti in cui
  rilasciare il gas restano gli stessi ma la gara dura un terzo.
- **Editor di circuiti** come nella V1: trascina i punti della spline, tocca la pista per
  aggiungerne uno, `✕ PUNTO` per toglierlo, scegli il tema, dai un nome e salva. I circuiti
  troppo stretti o che si sovrappongono vengono segnalati in rosso prima del salvataggio.
  I tuoi circuiti compaiono nel menu (con ✎ per modificarli) e si salvano sul dispositivo.
- **Record per circuito** salvato sul dispositivo e pulsante *Condividi su 𝕏*.

## Come si gioca

| Azione | Touch | Tastiera |
| --- | --- | --- |
| Gas | pedale GAS (o un dito ovunque sullo schermo) | ↑ / W / Spazio |
| Turbo | pulsante TURBO | Enter / Q / Shift |
| Pausa | ⏸ in alto a sinistra | Esc |
| Telecamera | 🗺️ / 🎥 | C |
| Audio | 🔊 | M |

**Tasti multiplayer:** P1 `↑` + `Invio`, P2 `W` + `Q`, P3 `I` + `U`, P4 `Num8` + `Num7` (gas, turbo).
Nel menu `1P` sceglie quanti piloti (1–4), `3G` quanti giri, `×3` la velocità e `IA / NO IA` se
riempire le corsie libere. `✎ EDITOR` apre l'editor di circuiti.

Al semaforo tieni premuto il GAS per partire forte. Più stelle ha il circuito, più veloci
sono gli avversari.

## Sviluppo

Nessuna build: `index.html` + `game.js` (canvas vanilla, 400×720 verticale). Apri
`index.html` in un browser oppure servi la cartella con un qualsiasi server statico.
`tools/publish.sh` fa commit e push su GitHub Pages.

## Licenza

MIT — © Pippo Poppi Games. Gli altri giochi: https://github.com/pippopoppi
