# Racism 2 — Super Slot Racing 🏁

Gioco di corse slot car per browser, gratis e senza installare nulla.
**Gioca:** https://pippopoppi.github.io/racism2/

Il seguito di Slotcars Simulator, rifatto da zero: fisica più onesta, grafica nuova,
motore da supercar sintetizzato in tempo reale e avversari IA.

## Novità rispetto alla versione 1

- **Niente più deragliamenti ingiusti.** La macchina non vola via appena superi il limite:
  prima scivola (fumo, stridio, striscia sull'asfalto), lo schermo si tinge di rosso e compare
  l'avviso *TROPPO VELOCE!*. Deragli solo se insisti o entri in curva molto troppo forte.
- **Pedale del freno** (sinistra) oltre al gas (destra), più **TURBO ⚡** con 3 cariche a gara.
- **Linea di gara sul tracciato:** davanti alla macchina la corsia si colora di giallo
  ("dovrai frenare") o rosso ("frena ADESSO").
- **Motore da supercar** via Web Audio: 6 marce con cambiata, scarico, fischio del turbo,
  stridio delle gomme, botto al deragliamento, semaforo F1 e fanfara d'arrivo.
- **5 circuiti con ambienti diversi:** ovale nel deserto rosso, autodromo con tribune,
  riviera sul mare, cittadino di notte al neon, tornanti alpini sulla neve (grip ridotto).
- **3 avversari IA** con nomi e abilità diverse, classifica live, minimappa, giri 1/3/5.
- **Telecamera dinamica** che ruota e zooma con la velocità, cordoli, tribune, cartelloni,
  barriere di pneumatici, lampioni, fari di notte, particelle e segni di gomma persistenti.
- **Record per circuito** salvato sul dispositivo e pulsante *Condividi su 𝕏*.

## Come si gioca

| Azione | Touch | Tastiera |
| --- | --- | --- |
| Gas | pedale destro (o metà destra in basso) | ↑ / W / Spazio |
| Freno | pedale sinistro (o metà sinistra in basso) | ↓ / S / Shift |
| Turbo | pulsante TURBO | Enter / T / Ctrl |
| Pausa | ⏸ in alto a sinistra | Esc |
| Audio | 🔊 | M |

Al semaforo tieni premuto il GAS per partire forte. Più stelle ha il circuito, più veloci
sono gli avversari.

## Sviluppo

Nessuna build: `index.html` + `game.js` (canvas vanilla, 400×720 verticale). Apri
`index.html` in un browser oppure servi la cartella con un qualsiasi server statico.
`tools/publish.sh` fa commit e push su GitHub Pages.

## Licenza

MIT — © Pippo Poppi Games. Gli altri giochi: https://github.com/pippopoppi
