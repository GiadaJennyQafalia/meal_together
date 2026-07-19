## Diagnosi dei 3 bug

**Bug 1 — Immagini bianche (foto ricetta + copertina cartella)**
- Il bucket `ricette-immagini` è **privato**, ma il codice in `src/routes/ricette.$id.tsx` chiama `supabase.storage.from(...).getPublicUrl(path)`. Su un bucket privato quell'URL restituisce un 400/errore silenzioso → l'`<img>` resta vuoto (tinta unita).
- Le cartelle oggi **non hanno un campo immagine proprio**: `CartelleGrid` prende come copertina la prima ricetta interna che ha `immagine_url`. Quindi la "copertina cartella" eredita lo stesso bug + non è impostabile a mano.
- **Fix scelto**: bucket resta privato, si usa URL firmato temporaneo generato al momento del rendering (`createSignedUrl`), cachato in memoria con TTL. Si aggiunge un campo `immagine_url` alla tabella `cartelle` con upload dedicato.

**Bug 2 — "Label sbagliata IMMAGINE CARTELLA"**
- Nel codice attuale non esiste quel testo — chiarito: il problema vero è **funzionale**, non testuale (foto bianca, vedi Bug 1) + **manca del tutto** l'upload copertina cartella. Nessuna correzione di stringa da fare.

**Bug 3 — Tag non filtrabili globalmente**
- L'editor tag in `ricette.$id.tsx` funziona e salva. Manca il filtro globale in cima al Ricettario: oggi i chip tag esistono solo dentro `CartellaDetail` e filtrano solo le ricette di quella cartella. Serve un filtro tag trasversale su tutte le cartelle.

## Impatto

- **Schema**: 1 sola migration additiva → aggiungere `immagine_url text nullable` a `cartelle`. Nessuna modifica distruttiva. Nessuna anteprima dati necessaria (colonna nuova, nullable).
- **Storage**: nessun cambio di policy sul bucket (resta privato, upload/read già coperte dalle policy condivise esistenti).
- **Frontend**: 
  - `src/routes/ricette.$id.tsx` — sostituire `getPublicUrl` con signed URL
  - `src/routes/ricette.tsx` — sostituire `getPublicUrl` per la copertina cartella, aggiungere UI upload copertina cartella nel foglio "Gestisci cartelle", aggiungere barra chip tag globali sopra la griglia cartelle
  - `src/lib/ricette.functions.ts` — accettare `immagine_url` in `createCartella`/`renameCartella` (o aggiungere `updateCartella`)
- **Rischio incrociato**: basso. I 3 fix toccano zone diverse. L'unico punto condiviso è l'helper signed-URL che verrà usato sia da ricette che da cartelle — se rotto rompe entrambe le immagini, ma è isolabile.

---

## Prompt pronto da incollare in Build

> Fixa in un unico passaggio i 3 bug del Ricettario. Segui esattamente questa scaletta, non chiedere conferme intermedie.
>
> **1. Migration additiva (non distruttiva)**
> Aggiungi alla tabella `cartelle` una colonna `immagine_url text nullable`. Nient'altro. Non toccare `ricette`, `ricetta_ingredienti`, policy RLS o bucket. Non serve anteprima dati: è una colonna nuova vuota.
>
> **2. Immagini bianche — usa signed URL invece di getPublicUrl**
> Il bucket `ricette-immagini` è privato e deve restare privato. Sostituisci ogni chiamata a `supabase.storage.from('ricette-immagini').getPublicUrl(...)` con `createSignedUrl(path, 3600)`. 
> - Crea un piccolo helper client (es. `src/lib/signed-image.ts`) che espone un hook `useSignedImage(pathOrUrl)`: se il valore è già un URL http(s) firmato/pubblico lo restituisce così com'è (retrocompatibilità con eventuali URL già salvati), altrimenti tratta il valore come path del bucket e restituisce l'URL firmato. Cache in memoria con TTL 55 minuti per evitare firme continue.
> - **Salva su DB il path del bucket** (es. `<ricetta_id>/1234.jpg`) invece dell'URL pubblico rotto. All'upload, usa `data.path` restituito da `.upload(...)` come valore di `immagine_url`. Non fare backfill dei valori esistenti: se in `ricette.immagine_url` c'è già una URL `http(s)`, l'hook la usa così com'è.
> - Applica l'hook in `src/routes/ricette.$id.tsx` (anteprima + upload) e in `src/routes/ricette.tsx` (`CartelleGrid` cover, `RicettaCard` thumbnail).
>
> **3. Upload copertina cartella**
> Nel foglio "Gestisci cartelle" (`ManageCartelleSheet` in `src/routes/ricette.tsx`), aggiungi accanto al nome di ogni cartella un mini-uploader (icona + input file nascosto) che carica l'immagine sul bucket `ricette-immagini` sotto path `_cartelle/<cartella_id>/<timestamp>.<ext>` e aggiorna `cartelle.immagine_url` col path restituito. Estendi `src/lib/ricette.functions.ts` aggiungendo `updateCartella({ id, immagine_url })` (o allarga `renameCartella` a patch generica — preferisci una nuova `updateCartella` per non rompere l'API esistente). Mostra anteprima con lo stesso hook signed URL. `CartelleGrid` deve preferire `cartella.immagine_url` alla copertina derivata dalla prima ricetta, che resta come fallback quando la cartella non ha copertina propria.
>
> **4. Filtro tag globale nel Ricettario**
> In `src/routes/ricette.tsx`, sopra la griglia cartelle (view `cartelle`) aggiungi una barra orizzontale scrollabile di chip tag, calcolata come unione di `ricette.tag` su tutte le ricette. Selezionando un chip:
> - la griglia cartelle deve filtrarsi mostrando solo le cartelle che contengono almeno una ricetta con quel tag,
> - dentro ciascuna cartella filtrata, il conteggio e la copertina devono riflettere solo le ricette che hanno il tag,
> - aprendo una cartella con un tag attivo, il tag resta selezionato anche nel `CartellaDetail` esistente (unifica lo stato `tagFilter` che ora è locale in `RicettePage`).
> Chip attivo = riempito scuro come già fatto. Se nessuna ricetta ha tag, non mostrare la barra.
>
> **Cosa NON deve cambiare**
> - Nessuna modifica alle policy RLS o alla visibilità del bucket `ricette-immagini` (resta privato).
> - Nessuna modifica a `ricette`, `ricetta_ingredienti`, `lista_spesa`, `prezzi_prodotti`, `ricette_da_provare`.
> - Nessun cambio al pattern di auth condivisa (no login).
> - Non rimuovere il campo `ricette.ingredienti` text[] (backup).
> - Non toccare la tab "Da rifare" / "Da provare".
> - Le URL immagine già salvate in `ricette.immagine_url` devono continuare a caricarsi (retrocompat via hook).
>
> **Verifica finale**
> Dopo la build, controlla che: (a) caricando una foto ricetta l'anteprima appare subito e resta visibile dopo un refresh; (b) la copertina cartella caricata a mano ha precedenza su quella derivata; (c) un tag creato su una ricetta appare nella barra chip in cima al Ricettario e filtra le cartelle. Se qualcosa non funziona, fixalo prima di considerare chiuso il task.