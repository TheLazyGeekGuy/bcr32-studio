// BCR32 Studio — Presentation, i18n & Interactive Starfield. No MIDI acquisition.
document.documentElement.classList.add('js');
// Preserve explicit legacy editor deep links, without mounting MIDI on the presentation page.
if (new URLSearchParams(location.search).has('editor') || new URLSearchParams(location.search).has('workspace')) {
  location.replace(new URL('./editor/' + location.search + location.hash, location.href));
}

// -------------------------------------------------------------
// 1. INTERNATIONALIZATION (i18n) — English Default & French
// -------------------------------------------------------------
const translations = {
  en: {
    doc_title: 'BCR32 Studio & Sequencer — MIDI Studio',
    doc_desc: 'BCR32 Studio: the modular Web MIDI controller editor, polyphonic step sequencer, OLED multiplexer, Cubase MIDI Remote script generator, and PDF overlay creator for the Behringer BCR-32.',
    skip_link: 'Skip to content',
    nav_brand_aria: 'BCR32 Studio, home',
    nav_main_aria: 'Main navigation',
    nav_duo: 'The Duo',
    nav_features: 'Features',
    nav_workflow: 'Workflow',
    nav_roadmap: 'Roadmap',
    nav_sysex_docs: 'SXM docs',
    footer_sxm_docs: 'SysEx Map format & examples',
    lang_switch_aria: 'Language selection',
    stars_label: 'Stars',
    nav_cta: 'Quick start',
    hero_eyebrow: 'MIDI Studio · active project v0.46.0-alpha.11',
    hero_copy: 'Your 32 encoders. Your 4-track polyphonic sequencer. Your overlays.<br>A visual editor to inspect controls, sculpt grooves, and drive synths safely.',
    hero_btn_editor: 'Explore the modes',
    hero_btn_agent: "Open editor",
    hero_btn_firmware: 'Official Behringer firmware & docs',
    hero_img_alt: 'BCR32 Studio Controller interface showing 32 illuminated rotary push-encoders, 15-LED rings, parameter inspector sidebar, live activity strip, and toolbar',
    hero_caption: 'BCR32 Studio · Controller View — 32 rotary encoders, 15-LED halo rings, MIDI inspector & OLED multiplexing',
    hero_tag_1: '32 Push-Encoders & LED Rings',
    hero_tag_2: '4-Track Polyphonic Step Sequencer',
    hero_tag_3: 'Official Firmware v1.0.3 & Overlays',
    duo_eyebrow: '01 / Two complementary modes',
    duo_title: 'Control & Sequence.<br><span>One unified workspace.</span>',
    duo_lead: 'BCR32 Studio brings together the two personalities of the BCR-32: a precision 32-encoder MIDI controller editor with OLED multiplexing, and a full-featured 4-track polyphonic step sequencer.',
    tab_switch_aria: 'Discover the tools',
    tab_controller: 'Controller Mode',
    tab_controller_sub: '32 Encoders & OLED',
    tab_sequencer: 'Sequencer Mode',
    tab_sequencer_sub: '4 Tracks × 32 Steps',
    controller_window_title: 'BCR32 Studio — Controller View · 32 Encoders & LED Rings',
    controller_window_note: 'Live v0.46.0-alpha.11',
    controller_img_alt: 'Actual BCR32 Studio Controller interface showing 32 rotary push-encoders, parameter inspector sidebar, live MIDI activity strip, and tabs',
    controller_eyebrow: 'Inspect, map, organize',
    controller_title: 'Your 32 encoders,<br>down to the last byte.',
    controller_lead: 'Map CC, 14-bit high-resolution NRPN, Pitch Bend, and Notes directly on the visual front panel. Configure 15-LED halo ring feedback, custom printed names, and export Cubase 12+ MIDI Remote scripts.',
    controller_li_1: '32 rotary push-encoders with dual independent targets: rotation & central push button',
    controller_li_2: '15-LED halo ring feedback modes: Single dot, Bar graph, Boost/Cut Pan, Spread, and Off',
    controller_li_3: "CC, 14-bit NRPN, Pitch Bend, Aftertouch, Note, MMC, Program Change and custom BCL/SysEx",
    controller_li_4: 'Printable A4 PDF overlay generator: print custom paper masks tailored to your knob names',
    controller_link: "Open editor",
    controller_hw_link: 'Behringer 0715-AAW hardware page',
    controller_demo_note: 'Runs in Chrome, Edge, Brave, Opera via Web MIDI API.',
    sequencer_window_title: 'BCR32 Studio — Sequencer View · T1–T4 Polyphonic Steps & Lanes',
    sequencer_window_note: 'Preview v0.45+',
    sequencer_img_alt: 'BCR32 Studio Sequencer interface showing 4 tracks T1-T4, 32 steps grid, velocity, note length, and timing offset lanes, step inspector and template library',
    sequencer_eyebrow: 'Polyphonic groove & micro-timing',
    sequencer_title: 'Four 32-step tracks.<br>Tactile groove editing.',
    sequencer_lead: 'Shape pitch, velocity, gate length, and timing offsets across 4 independent tracks (128 steps total). Work in Grid, Piano Roll, or Behringer Table view, enter steps from your keyboard, and exchange MIDI and SysEx patterns.',
    sequencer_li_1: '4 polyphonic tracks (T1–T4) with 32 steps, per-step mute, skip, and bar accents on steps 1, 5, 9 … 29',
    sequencer_li_2: 'Dedicated visual lanes for Velocity (0–127), Gate/Length, and Micro-timing Delay (±5 ticks)',
    sequencer_li_3: 'Step entry from computer keyboard (A W S E D … K) or external MIDI keyboard chosen in settings',
    sequencer_li_4: "MIDI and SysEx file import/export; verified 1.0.3 step reads and individual edit-buffer writes.",
    sequencer_link: 'Explore Sequencer live',
    sequencer_local_link: 'Run locally with Vite',
    sequencer_demo_note: "Firmware 1.0.3: the current pattern is read automatically and live editing starts after successful reading. No automatic STORE.",
    features_eyebrow: '02 / Under the hood',
    features_title: 'Tactile depth,<br><span>down to the MIDI byte.</span>',
    features_lead: 'From 15-LED halo ring behaviors to Cubase MIDI Remote scripts and 4-track polyphonic grooves, every parameter is transparent, editable, and non-destructive.',
    feat_1_title: 'Interactive 32-Encoder Panel.',
    feat_1_desc: 'Complete visual replica with 32 push-encoders arranged in 4 rows of 8, upper function keys 1–16, T1–T4 track selectors, and the large SELECT rotary wheel.',
    feat_1_tag: '32 Encoders & 20 Function Keys',
    feat_2_title: 'Polyphonic 4-Track Sequencer.',
    feat_2_desc: 'Full 4-track × 32-step sequence editing with Grid, Piano Roll, and Behringer Table views. Dedicated lanes for velocity, gate length, and micro-timing offsets with MIDI and SysEx 04 0B import/export.',
    feat_2_tag: '4 Tracks × 32 Steps · Lanes & Piano Roll',
    feat_3_title: 'OLED Multiplexing & MIDI Follow.',
    feat_3_desc: 'Live time-shared OLED display tracks parameter changes as physical knobs turn. An always-on-top borderless floating display window keeps knob feedback visible above your DAW.',
    feat_3_tag: 'OLED Multiplexing & Floating Display',
    feat_4_title: 'Cubase MIDI Remote Export.',
    feat_4_desc: 'Exports complete JavaScript surface definitions for Cubase 12 and later. All 32 encoders and assigned keys appear natively in Cubase Mapping Assistant.',
    feat_4_tag: 'Cubase 12+ MIDI Remote JS',
    feat_5_title: 'Printable A4 PDF Overlays.',
    feat_5_desc: 'Generate precise, high-resolution A4 PDF overlay sheets containing all your custom encoder and button labels, ready to print and position directly over the hardware panel.',
    feat_5_tag: 'A4 Printable Cut-Out Masks',
    feat_6_title: "BCL & custom SysEx.",
    feat_6_desc: "Edit and preview SysEx templates for rotation and push. Back up, upload, read back and explicitly STORE controller presets; existing dump readers remain available.",
    feat_6_tag: "BCL · SysEx · Verified preset recall",
    wf_eyebrow: '03 / Crystal-clear routing',
    wf_title: 'Choose who drives.',
    wf_lead: 'Direct Web MIDI in your browser or autonomous standalone operation with exported Cubase scripts and PDF overlays.',
    wf_toggle_aria: 'Choose illustrated workflow',
    wf_btn_agent: 'Web MIDI Studio',
    wf_btn_browser: 'DAW & Overlays alone',
    wf_route_aria: 'Routing schema',
    wf_node_cs12: 'Behringer BCR-32 (0715-AAW)',
    wf_sub_cs12: '32 Push-Encoders · OLED · USB',
    wf_sub_agent: 'Controller & Sequencer Engine',
    wf_node_dest: 'Cubase, Synths & Plugins',
    wf_sub_dest: 'MIDI Remote · DIN Out · USB',
    wf_exp_agent: 'BCR32 Studio connects directly to your BCR-32 in Chrome, Edge, Brave, or Opera. Physical knob turns reflect instantly on screen, while UI gestures dispatch CC values to your target instruments without overwriting hardware flash.',
    wf_note_1_title: 'Driverless Web MIDI',
    wf_note_1_desc: 'USB MIDI class-compliant: no driver installation or kernel extensions needed. Works out of the box on macOS, Windows, and Linux.',
    wf_note_2_title: 'Non-destructive design',
    wf_note_2_desc: "Live sequencer edits change the current edit buffer. Persistent saves remain separate, explicit operations.",
    wf_note_3_title: 'Multi-controller family',
    wf_note_3_desc: 'Shares the same modular foundation as BCR2000, BCF2000 motorized faders, and the X-Touch family (Mini, Compact, Classic, Extender).',
    rm_eyebrow: '04 / Ongoing roadmap',
    rm_title: 'What’s here now.<br><span>What’s coming next.</span>',
    rm_lead: 'Current features in v0.46.0-alpha.11 alpha and upcoming milestones actively in progress.',
    rm_badge_ready: 'Available in v0.46.0-alpha.11 alpha',
    rm_ready_1: 'Interactive front panel with 32 push-encoders and 20 functional keys',
    rm_ready_2: 'Live bidirectional MIDI follow with OLED multiplexing and activity strip',
    rm_ready_3: "Per-control inspector with standard MIDI and custom BCL/SysEx templates",
    rm_ready_4: 'MIDI Learn for quick hardware knob-to-parameter binding',
    rm_ready_5: 'Floating always-on-top OLED display window for DAW integration',
    rm_ready_6: 'Printable A4 PDF overlay generator with custom labels',
    rm_ready_7: 'Cubase 12+ MIDI Remote JavaScript script export',
    rm_ready_8: '8 languages supported: EN, FR, IT, DE, JA, ES, RU, ZH',
    rm_ready_note: "Firmware 1.0.3: rotation/push STORE and preset recall tested, with complete bank restoration. <a href=\"./editor/\" target=\"_blank\" rel=\"noopener\">Open editor</a>",
    rm_badge_planned: 'Under active development (In progress)',
    rm_plan_1: "Complete sequencer track/global controls and qualify persistent pattern storage.",
    rm_plan_2: "Optional desktop companion and virtual MIDI routing: separate from this browser build.",
    rm_plan_3: "Further display and hardware-feedback validation.",
    rm_plan_4: "Other controllers are separate modules; this distribution contains BCR32 only.",
    rm_plan_5: "Custom SysEx emission on physical gestures, advanced tokens and power-cycle persistence still need validation.",
    rm_hw_title: 'Official Behringer Firmware & Resources',
    rm_hw_desc: 'Need the official Firmware v1.0.3 update or Quick Start Guide? Visit the official Behringer BCR32 page.',
    rm_hw_btn: 'Download official firmware (Behringer 0715-AAW)',
    rm_plan_note: "Alpha software. Back up presets; no firmware flashing or automatic sequencer STORE.",
    faq_eyebrow: 'Key questions',
    faq_title: 'Before you start.',
    faq_q1: 'Does BCR32 Studio risk corrupting my hardware presets?',
    faq_a1: "Hardware changes are explicit and controller STORE is separate from editing. The firmware 1.0.3 rotation/push STORE and preset-recall test restored all 64 slots, globals and working contents. This alpha result is not a guarantee for every program; retain backups.",
    faq_q_fw: 'Where can I download the official Behringer firmware update?',
    faq_a_fw: 'The official firmware (such as v1.0.3), Quick Start Guides, and device specifications can be downloaded directly from the official Behringer product page at <a href="https://www.behringer.com/en/products/0715-AAW" target="_blank" rel="noopener">https://www.behringer.com/en/products/0715-AAW</a>.',
    faq_q2: 'What browsers support the Web MIDI connection?',
    faq_a2: 'Web MIDI is supported out of the box in Chromium-based browsers: Google Chrome, Microsoft Edge, Brave, and Opera. Connect your BCR-32 via USB and grant MIDI access when prompted.',
    faq_q3: 'Can I use BCR32 Studio without a BCR-32 plugged in?',
    faq_a3: "Yes. Edit assignments and BCL/SysEx templates, simulate messages, customize labels, generate PDF overlays, export Cubase scripts and compose sequences without hardware.",
    faq_q4: 'How does the Cubase MIDI Remote export work?',
    faq_a4: 'The editor generates a complete .js script describing the physical front panel layout and assigned MIDI messages. Place it in Cubase\'s MIDI Remote Driver Scripts folder to instantly map controls via Cubase\'s Mapping Assistant.',
    faq_q5: 'Is BCR32 backward compatible with BCR2000?',
    faq_a5: "This standalone distribution contains the BCR32 editor only. The shared MIDI Studio foundation has separate device modules; that does not make their protocols interchangeable.",
    closing_eyebrow: 'Ready to explore',
    closing_title: 'Put your hands on your sound.<br><span>Drive your studio with precision.</span>',
    closing_cta: "Open editor",
    closing_hw: 'Official Behringer 0715-AAW Page',
    closing_note: 'Open source community project · GitHub Pages build',
    footer_tagline: 'Web MIDI Controller Editor & Polyphonic Step Sequencer for Behringer BCR-32.',
    footer_col_app: 'Application',
    footer_col_docs: 'Documentation',
    footer_col_hardware: 'Official Hardware',
    footer_legal: '&copy; 2026 MIDI Studio Project. Built for musicians, sound designers, and hardware tinkerers. Non-official community tool, not affiliated with Music Tribe or Behringer.',
    footer_top: '↑ Top',
    modal_title: 'Get Started with BCR32 Studio',
    modal_close_aria: 'Close dialog',
    modal_intro: 'BCR32 Studio is available both as a direct zero-install Web MIDI application and as a local open-source project.',
    modal_sec1_title: '1. Instant Web MIDI Access (Recommended)',
    modal_sec1_desc: 'Open the live build directly in Chrome, Edge, Brave, or Opera. Connect your BCR-32 via USB and accept the browser MIDI prompt.',
    modal_sec1_btn: "Open editor",
    modal_sec2_title: '2. Run Locally via Dev Server',
    modal_sec2_desc: 'Run the Vite development server on your machine with full offline capabilities:',
    modal_sec2_note: 'Then navigate to http://localhost:5183/editor/ in any Chromium browser.',
    modal_sec3_title: '3. Official Behringer Firmware (0715-AAW)',
    modal_sec3_desc: 'Download the latest official firmware updates (v1.0.3), Quick Start Guides, and technical specifications directly from Behringer:',
    modal_sec3_btn: 'Go to Behringer Product Downloads (0715-AAW)'
  },
  fr: {
    doc_title: 'BCR32 Studio & Séquenceur — MIDI Studio',
    doc_desc: 'BCR32 Studio : l\'éditeur Web MIDI modulaire, séquenceur pas-à-pas polyphonique, multiplexeur OLED, générateur de scripts Cubase et masques PDF pour le Behringer BCR-32.',
    skip_link: 'Aller au contenu',
    nav_brand_aria: 'BCR32 Studio, accueil',
    nav_main_aria: 'Navigation principale',
    nav_duo: 'Le Duo',
    nav_features: 'Fonctionnalités',
    nav_workflow: 'Fonctionnement',
    nav_roadmap: 'Disponibilité',
    nav_sysex_docs: 'Doc SXM',
    footer_sxm_docs: 'Format SysEx Map et exemples',
    lang_switch_aria: 'Sélection de langue',
    stars_label: 'Étoiles',
    nav_cta: 'Démarrage rapide',
    hero_eyebrow: 'MIDI Studio · projet actif v0.46.0-alpha.11',
    hero_copy: 'Vos 32 encodeurs. Votre séquenceur polyphonique 4 pistes. Vos masques.<br>Un éditeur visuel pour inspecter vos contrôles, sculpter vos rythmes et piloter vos synthétiseurs.',
    hero_btn_editor: 'Explorer les modes',
    hero_btn_agent: "Ouvrir l’éditeur",
    hero_btn_firmware: 'Firmware officiel & docs Behringer',
    hero_img_alt: 'Interface Contrôleur de BCR32 Studio montrant 32 encodeurs rotatifs rétroéclairés, anneaux 15 LEDs, barre latérale d\'inspection et bandeau d\'activité',
    hero_caption: 'BCR32 Studio · Mode Contrôleur — 32 encodeurs rotatifs, anneaux 15 LEDs, inspecteur MIDI & multiplexage OLED',
    hero_tag_1: '32 encodeurs push & anneaux LED',
    hero_tag_2: 'Séquenceur pas-à-pas polyphonique 4 pistes',
    hero_tag_3: 'Firmware officiel v1.0.3 & masques PDF',
    duo_eyebrow: '01 / Deux modes complémentaires',
    duo_title: 'Contrôler & Séquencer.<br><span>Un même espace de travail.</span>',
    duo_lead: 'BCR32 Studio réunit les deux identités du BCR-32 : un éditeur de contrôleur MIDI haute précision à 32 encodeurs avec multiplexage OLED, et un séquenceur pas-à-pas polyphonique 4 pistes complet.',
    tab_switch_aria: 'Découvrir les outils',
    tab_controller: 'Mode Contrôleur',
    tab_controller_sub: '32 encodeurs & OLED',
    tab_sequencer: 'Mode Séquenceur',
    tab_sequencer_sub: '4 pistes × 32 pas',
    controller_window_title: 'BCR32 Studio — Mode Contrôleur · 32 encodeurs & anneaux LED',
    controller_window_note: 'En direct v0.46.0-alpha.11',
    controller_img_alt: 'Véritable interface Contrôleur de BCR32 Studio montrant 32 encodeurs rotatifs, barre d\'inspection, bandeau d\'activité MIDI et onglets',
    controller_eyebrow: 'Inspecter, assigner, organiser',
    controller_title: 'Vos 32 encodeurs,<br>jusqu’au moindre octet.',
    controller_lead: 'Assignez CC, NRPN 14 bits haute résolution, Pitch Bend et Notes directement sur la façade visuelle. Réglez le retour des anneaux à 15 LEDs, vos étiquettes personnalisées et exportez des scripts Cubase 12+ MIDI Remote.',
    controller_li_1: '32 encodeurs rotatifs avec double cible indépendante : rotation et bouton-poussoir central',
    controller_li_2: 'Modes de halo pour l’anneau de 15 LEDs : point unique, barre-graphe, pan boost/cut, étalé et éteint',
    controller_li_3: "CC, NRPN 14 bits, Pitch Bend, Aftertouch, Note, MMC, Program Change et BCL/SysEx personnalisés",
    controller_li_4: 'Générateur de masques PDF imprimables en A4 : imprimez des gabarits papier découpables adaptés à vos noms de potards',
    controller_link: "Ouvrir l’éditeur",
    controller_hw_link: 'Page matérielle Behringer 0715-AAW',
    controller_demo_note: 'Fonctionne dans Chrome, Edge, Brave, Opera via l’API Web MIDI.',
    sequencer_window_title: 'BCR32 Studio — Mode Séquenceur · Pistes T1–T4 & Lignes de contrôle',
    sequencer_window_note: 'Préversion v0.45+',
    sequencer_img_alt: 'Interface Séquenceur de BCR32 Studio montrant 4 pistes T1-T4, grille de 32 pas, lignes de vélocité, longueur et décalage temporel',
    sequencer_eyebrow: 'Groove polyphonique & micro-timing',
    sequencer_title: 'Quatre pistes de 32 pas.<br>Le groove sous la main.',
    sequencer_lead: 'Sculptez les hauteurs de note, vélocités, longueurs de gate et micro-décalages temporels sur 4 pistes indépendantes (128 pas polyphoniques). Travaillez en vue Grille, Piano Roll ou Tableau Behringer, saisissez vos notes au clavier et échangez vos fichiers MIDI et SysEx.',
    sequencer_li_1: '4 pistes polyphoniques (T1–T4) de 32 pas avec mute, skip par pas et accents de mesure (pas 1, 5, 9 … 29)',
    sequencer_li_2: 'Lignes visuelles dédiées pour la Vélocité (0–127), la Longueur de gate et le Micro-décalage (±5 ticks)',
    sequencer_li_3: 'Saisie de pas au clavier d’ordinateur (touches A W S E D … K) ou depuis un clavier maître MIDI sélectionné',
    sequencer_li_4: "Import/export de fichiers MIDI et SysEx ; lecture des pas et modifications individuelles vérifiées sur le tampon d’édition en 1.0.3.",
    sequencer_link: 'Explorer le Séquenceur en direct',
    sequencer_local_link: 'Lancer en local avec Vite',
    sequencer_demo_note: "Firmware 1.0.3 : lecture automatique du pattern courant, puis édition live après une lecture réussie. Aucun STORE automatique.",
    features_eyebrow: '02 / Sous le capot',
    features_title: 'Précision tactile,<br><span>jusqu’à l’octet MIDI.</span>',
    features_lead: 'Du comportement des anneaux 15 LEDs aux scripts Cubase MIDI Remote et aux grooves polyphoniques 4 pistes, chaque paramètre est transparent, éditable et non destructif.',
    feat_1_title: 'Façade interactive 32 encodeurs.',
    feat_1_desc: 'Réplique visuelle complète avec 32 encodeurs rotatifs à poussoir en 4 rangées de 8, touches de fonction 1–16, sélecteurs T1–T4 et grande molette rotative SELECT.',
    feat_1_tag: '32 encodeurs & 20 touches de fonction',
    feat_2_title: 'Séquenceur polyphonique 4 pistes.',
    feat_2_desc: 'Édition complète de 4 pistes × 32 pas avec vues Grille, Piano Roll et Tableau Behringer. Lignes graphiques pour vélocité, gate et micro-timing avec import/export MIDI et SysEx 04 0B.',
    feat_2_tag: '4 pistes × 32 pas · Lignes & Piano Roll',
    feat_3_title: 'Multiplexage OLED & suivi MIDI.',
    feat_3_desc: 'L’écran OLED partagé en temps réel affiche le paramètre dès qu’un bouton physique tourne. Une fenêtre flottante sans bordure reste toujours visible au-dessus de votre DAW.',
    feat_3_tag: 'Multiplexage OLED & fenêtre flottante',
    feat_4_title: 'Export Cubase MIDI Remote.',
    feat_4_desc: 'Génère automatiquement les scripts JavaScript pour Cubase 12 et versions ultérieures. Tous les 32 encodeurs et touches assignées apparaissent nativement dans l’Assistant de télécommande MIDI.',
    feat_4_tag: 'Cubase 12+ MIDI Remote JS',
    feat_5_title: 'Masques PDF imprimables en A4.',
    feat_5_desc: 'Générez des planches de masques découpables A4 haute précision à l’échelle 1:1 comportant toutes vos étiquettes personnalisées, prêtes à être posées directement sur la façade matérielle.',
    feat_5_tag: 'Planches découpables A4 imprimables',
    feat_6_title: "BCL & SysEx personnalisés.",
    feat_6_desc: "Éditez et simulez des SysEx pour la rotation et le push. Sauvegarde, envoi, relecture et STORE explicite des presets du contrôleur ; les lecteurs de dumps restent disponibles.",
    feat_6_tag: "BCL · SysEx · Rappel de preset vérifié",
    wf_eyebrow: '03 / Routage limpide',
    wf_title: 'Choisissez qui pilote.',
    wf_lead: 'Web MIDI direct dans votre navigateur ou fonctionnement autonome avec scripts Cubase et masques PDF exportés.',
    wf_toggle_aria: 'Choisir le flux illustré',
    wf_btn_agent: 'Studio Web MIDI',
    wf_btn_browser: 'DAW & masques seuls',
    wf_route_aria: 'Schéma de routage',
    wf_node_cs12: 'Behringer BCR-32 (0715-AAW)',
    wf_sub_cs12: '32 encodeurs rotatifs · OLED · USB',
    wf_sub_agent: 'Moteur Contrôleur & Séquenceur',
    wf_node_dest: 'Cubase, synthés & plugins',
    wf_sub_dest: 'MIDI Remote · Sortie DIN · USB',
    wf_exp_agent: 'BCR32 Studio se connecte directement à votre BCR-32 dans Chrome, Edge, Brave ou Opera. Vos rotations physiques se répercutent à l’écran, tandis que l’interface envoie des valeurs CC à vos instruments cibles sans écriture risquée en mémoire.',
    wf_note_1_title: 'Web MIDI sans pilote',
    wf_note_1_desc: 'Conforme à la classe USB MIDI : aucune installation de pilote ou d’extension système. Fonctionne immédiatement sous macOS, Windows et Linux.',
    wf_note_2_title: 'Conception non destructive',
    wf_note_2_desc: "Les modifications live du séquenceur changent le tampon d’édition courant. Les sauvegardes permanentes restent des opérations séparées et explicites.",
    wf_note_3_title: 'Famille multi-contrôleurs',
    wf_note_3_desc: 'Partage les mêmes fondations modulaires que le BCR2000, les faders motorisés BCF2000 et la gamme X-Touch (Mini, Compact, Classic, Extender).',
    rm_eyebrow: '04 / Feuille de route en cours',
    rm_title: 'Ce qui est disponible.<br><span>Ce qui est en cours de développement.</span>',
    rm_lead: 'Fonctionnalités actuelles en alpha v0.46.0-alpha.11 et modules en cours de développement actif.',
    rm_badge_ready: 'Disponible en alpha v0.46.0-alpha.11',
    rm_ready_1: 'Façade interactive avec 32 encodeurs rotatifs à poussoir et 20 touches de fonction',
    rm_ready_2: 'Suivi MIDI bidirectionnel en direct avec multiplexage OLED et bandeau d’activité',
    rm_ready_3: "Inspecteur par contrôle : MIDI standard et modèles BCL/SysEx personnalisés",
    rm_ready_4: 'MIDI Learn pour lier instantanément un bouton physique à un paramètre',
    rm_ready_5: 'Fenêtre d’affichage OLED flottante toujours au premier plan pour vos sessions DAW',
    rm_ready_6: 'Générateur de masques PDF imprimables en A4 avec noms personnalisés',
    rm_ready_7: 'Export de scripts JavaScript Cubase 12+ MIDI Remote',
    rm_ready_8: '8 langues disponibles : EN, FR, IT, DE, JA, ES, RU, ZH',
    rm_ready_note: "Firmware 1.0.3 : STORE et rappel testés pour la rotation et le push, avec restauration complète de la banque. <a href=\"./editor/\" target=\"_blank\" rel=\"noopener\">Ouvrir l’éditeur</a>",
    rm_badge_planned: 'En cours de développement actif',
    rm_plan_1: "Compléter les réglages de pistes et globaux du séquenceur et valider la sauvegarde permanente des patterns.",
    rm_plan_2: "Compagnon de bureau et routage MIDI virtuel optionnels : distincts de cette version navigateur.",
    rm_plan_3: "Poursuivre la validation des affichages et des retours matériels.",
    rm_plan_4: "Les autres contrôleurs sont des modules séparés ; cette distribution ne contient que le BCR32.",
    rm_plan_5: "L’émission SysEx sur geste physique, les tokens avancés et la persistance après extinction restent à valider.",
    rm_hw_title: 'Firmware officiel & ressources Behringer',
    rm_hw_desc: 'Besoin de la mise à jour officielle Firmware v1.0.3 ou du guide de démarrage rapide ? Consultez la page officielle Behringer BCR32.',
    rm_hw_btn: 'Télécharger le firmware officiel (Behringer 0715-AAW)',
    rm_plan_note: "Logiciel alpha. Sauvegardez vos presets ; aucun flashage ni STORE automatique du séquenceur.",
    faq_eyebrow: 'Questions fréquentes',
    faq_title: 'Avant de commencer.',
    faq_q1: 'BCR32 Studio risque-t-il d’endommager mes presets sur l’appareil ?',
    faq_a1: "Les modifications matérielles sont explicites et le STORE du contrôleur est séparé de l’édition. Le test 1.0.3 rotation/push, STORE et rappel a restauré les 64 emplacements, les réglages globaux et le preset courant. Ce résultat alpha ne garantit pas tous les programmes : conservez vos sauvegardes.",
    faq_q_fw: 'Où puis-je télécharger la mise à jour officielle du firmware Behringer ?',
    faq_a_fw: 'Le firmware officiel (comme la version 1.0.3), les guides de démarrage rapide et les spécifications techniques se téléchargent directement sur la page officielle du produit Behringer à l’adresse <a href="https://www.behringer.com/en/products/0715-AAW" target="_blank" rel="noopener">https://www.behringer.com/en/products/0715-AAW</a>.',
    faq_q2: 'Quels navigateurs prennent en charge la connexion Web MIDI ?',
    faq_a2: 'Le Web MIDI fonctionne nativement dans les navigateurs basés sur Chromium : Google Chrome, Microsoft Edge, Brave et Opera. Branchez votre BCR-32 en USB et autorisez l’accès MIDI lorsque le navigateur vous y invite.',
    faq_q3: 'Puis-je utiliser BCR32 Studio sans brancher de BCR-32 ?',
    faq_a3: "Oui. Éditez vos assignations et modèles BCL/SysEx, simulez les messages, personnalisez les étiquettes, générez des masques PDF, exportez des scripts Cubase et composez des séquences sans matériel.",
    faq_q4: 'Comment fonctionne l’export Cubase MIDI Remote ?',
    faq_a4: 'L’éditeur génère un script .js décrivant la disposition physique de la façade et les messages MIDI configurés. Déposez-le dans le dossier Scripts de Cubase pour mapper automatiquement vos contrôleurs via l’Assistant de télécommande MIDI.',
    faq_q5: 'Le BCR32 est-il compatible avec les presets du BCR2000 ?',
    faq_a5: "Cette distribution autonome contient uniquement l’éditeur BCR32. Le socle MIDI Studio possède des modules distincts ; leurs protocoles ne sont pas interchangeables.",
    closing_eyebrow: 'Prêt à explorer',
    closing_title: 'Mettez la main sur votre son.<br><span>Pilotez votre studio avec précision.</span>',
    closing_cta: "Ouvrir l’éditeur",
    closing_hw: 'Page officielle Behringer 0715-AAW',
    closing_note: 'Projet communautaire open source · Build GitHub Pages',
    footer_tagline: 'Éditeur de contrôleur Web MIDI & Séquenceur pas-à-pas polyphonique pour Behringer BCR-32.',
    footer_col_app: 'Application',
    footer_col_docs: 'Documentation',
    footer_col_hardware: 'Matériel officiel',
    footer_legal: '&copy; 2026 Projet MIDI Studio. Conçu pour les musiciens, sound designers et passionnés de matériel. Outil communautaire non officiel, non affilié à Music Tribe ou Behringer.',
    footer_top: '↑ Haut',
    modal_title: 'Démarrer avec BCR32 Studio',
    modal_close_aria: 'Fermer la boîte de dialogue',
    modal_intro: 'BCR32 Studio est disponible sous forme d’application Web MIDI directe sans installation, ainsi qu’en projet open-source local.',
    modal_sec1_title: '1. Accès Web MIDI instantané (recommandé)',
    modal_sec1_desc: 'Ouvrez la version en ligne directement dans Chrome, Edge, Brave ou Opera. Branchez votre BCR-32 en USB et validez l’autorisation MIDI.',
    modal_sec1_btn: "Ouvrir l’éditeur",
    modal_sec2_title: '2. Lancer en local via le serveur Vite',
    modal_sec2_desc: 'Exécutez le serveur de développement Vite sur votre ordinateur avec fonctionnement 100 % hors ligne :',
    modal_sec2_note: 'Puis accédez à http://localhost:5183/editor/ dans un navigateur Chromium.',
    modal_sec3_title: '3. Firmware officiel Behringer (0715-AAW)',
    modal_sec3_desc: 'Téléchargez les dernières mises à jour officielles du firmware (v1.0.3), les guides de démarrage rapide et les spécifications techniques directement chez Behringer :',
    modal_sec3_btn: 'Accéder aux téléchargements Behringer (0715-AAW)'
  }
};

let currentLang = 'en';

function applyLanguage(lang) {
  if (!translations[lang]) lang = 'en';
  currentLang = lang;
  document.documentElement.lang = lang;
  localStorage.setItem('bcr32_site_lang', lang);

  // Update language buttons active state
  document.querySelectorAll('.lang-btn').forEach(btn => {
    const isActive = btn.dataset.lang === lang;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  const dict = translations[lang];

  // Text content replacements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (dict[key] !== undefined) el.textContent = dict[key];
  });

  // HTML content replacements
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.dataset.i18nHtml;
    if (dict[key] !== undefined) el.innerHTML = dict[key];
  });

  // Attribute replacements
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = el.dataset.i18nAria;
    if (dict[key] !== undefined) el.setAttribute('aria-label', dict[key]);
  });

  // Re-apply cache busters to any updated links
  if (typeof refreshAllCacheBustingLinks === 'function') {
    refreshAllCacheBustingLinks();
  }

  document.querySelectorAll('[data-i18n-alt]').forEach(el => {
    const key = el.dataset.i18nAlt;
    if (dict[key] !== undefined) el.setAttribute('alt', dict[key]);
  });

  document.querySelectorAll('[data-i18n-content]').forEach(el => {
    const key = el.dataset.i18nContent;
    if (dict[key] !== undefined) el.setAttribute('content', dict[key]);
  });
}

// Language switch initialization
function initI18n() {
  const urlParams = new URLSearchParams(window.location.search);
  const langParam = urlParams.get('lang');
  const storedLang = localStorage.getItem('bcr32_site_lang');
  const userLang = langParam || storedLang || (navigator.language && navigator.language.startsWith('fr') ? 'fr' : 'en');
  applyLanguage(userLang);

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyLanguage(btn.dataset.lang);
    });
  });
}

// -------------------------------------------------------------
// 2. PRODUCT MODE SWITCHER (CONTROLLER vs SEQUENCER)
// -------------------------------------------------------------
function initProductSwitch() {
  const tabCtrl = document.getElementById('tab-controller') || document.getElementById('tab-editor');
  const tabSeq = document.getElementById('tab-sequencer') || document.getElementById('tab-agent');
  const panelCtrl = document.getElementById('panel-controller') || document.getElementById('panel-editor');
  const panelSeq = document.getElementById('panel-sequencer') || document.getElementById('panel-agent');

  if (!tabCtrl || !tabSeq || !panelCtrl || !panelSeq) return;

  function activateTab(tabToActivate, panelToShow, tabToDeactivate, panelToHide) {
    tabToActivate.setAttribute('aria-selected', 'true');
    tabToActivate.tabIndex = 0;
    panelToShow.hidden = false;

    tabToDeactivate.setAttribute('aria-selected', 'false');
    tabToDeactivate.tabIndex = -1;
    panelToHide.hidden = true;
  }

  tabCtrl.addEventListener('click', () => activateTab(tabCtrl, panelCtrl, tabSeq, panelSeq));
  tabSeq.addEventListener('click', () => activateTab(tabSeq, panelSeq, tabCtrl, panelCtrl));

  // Keyboard navigation for tabs
  tabCtrl.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      tabSeq.focus();
      tabSeq.click();
    }
  });
  tabSeq.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      tabCtrl.focus();
      tabCtrl.click();
    }
  });

  // Handle deep hash link (#duo, etc.)
  document.querySelectorAll('[data-product]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.product;
      if (target === 'sequencer') {
        activateTab(tabSeq, panelSeq, tabCtrl, panelCtrl);
      } else {
        activateTab(tabCtrl, panelCtrl, tabSeq, panelSeq);
      }
    });
  });
}

// -------------------------------------------------------------
// 3. WORKFLOW ROUTING TOGGLE
// -------------------------------------------------------------
function initWorkflowRoute() {
  const toggleButtons = document.querySelectorAll('.route-toggle button');
  const routeOwner = document.getElementById('route-owner');
  const routeSub = document.getElementById('route-sub');
  const routeProtocol = document.getElementById('route-protocol');
  const routeExp = document.getElementById('route-explanation');

  if (!toggleButtons.length) return;

  const descriptions = {
    agent: {
      en: 'BCR32 Studio connects directly to your BCR-32 in Chrome, Edge, Brave, or Opera. Physical knob turns reflect instantly on screen, while UI gestures dispatch CC values to your target instruments without overwriting hardware flash.',
      fr: 'BCR32 Studio se connecte directement à votre BCR-32 dans Chrome, Edge, Brave ou Opera. Vos rotations physiques se répercutent à l’écran, tandis que l’interface envoie des valeurs CC à vos instruments cibles sans écriture risquée en mémoire.'
    },
    browser: {
      en: 'Operate independently from any editor: load your exported Cubase 12+ MIDI Remote script into Cubase, overlay your printed A4 cut-out sheets, and enjoy an immediately mapped, labeled physical controller on your desk.',
      fr: 'Fonctionnez de façon 100 % autonome sans éditeur : chargez le script Cubase 12+ MIDI Remote exporté dans Cubase, posez votre masque papier A4 découpé et profitez immédiatement d’un contrôleur physique assigné et étiqueté sur votre bureau.'
    }
  };

  toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleButtons.forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      const route = btn.dataset.route;

      if (route === 'browser') {
        if (routeOwner) routeOwner.textContent = 'Cubase Remote JS / PDF';
        if (routeSub) routeSub.textContent = currentLang === 'fr' ? 'Gabarits & Scripts autonomes' : 'Standalone Scripts & Overlays';
        if (routeProtocol) routeProtocol.textContent = 'MIDI Remote / A4';
        if (routeExp) routeExp.textContent = descriptions.browser[currentLang] || descriptions.browser.en;
      } else {
        if (routeOwner) routeOwner.textContent = 'BCR32 Studio';
        if (routeSub) routeSub.textContent = currentLang === 'fr' ? 'Moteur Contrôleur & Séquenceur' : 'Controller & Sequencer Engine';
        if (routeProtocol) routeProtocol.textContent = 'MIDI / CC';
        if (routeExp) routeExp.textContent = descriptions.agent[currentLang] || descriptions.agent.en;
      }
    });
  });
}

// -------------------------------------------------------------
// 4. ACCESSIBILITY MODAL DIALOG
// -------------------------------------------------------------
function initModal() {
  const modal = document.getElementById('access-modal');
  if (!modal) return;
  const openers = document.querySelectorAll('[data-access]');
  const closers = modal.querySelectorAll('[data-close]');
  let lastFocused = null;

  function openModal() {
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
    if (lastFocused) lastFocused.focus();
  }

  openers.forEach(btn => btn.addEventListener('click', openModal));
  closers.forEach(el => el.addEventListener('click', closeModal));

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });
}

// -------------------------------------------------------------
// 5. INTERACTIVE COSMIC STARFIELD CANVAS
// -------------------------------------------------------------
function initStarfield() {
  const canvas = document.getElementById('stars-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const modes = ['particles', 'cosmic', 'minimal'];
  let modeIndex = 0;
  const toggleBtn = document.getElementById('stars-toggle');

  let width = 0;
  let height = 0;
  let stars = [];
  let shootingStars = [];
  let mouse = { x: -1000, y: -1000, radius: 140 };

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    createStars();
  }

  function createStars() {
    stars = [];
    const count = Math.floor((width * height) / (modes[modeIndex] === 'minimal' ? 22000 : 12000));
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.8 + 0.4,
        alpha: Math.random() * 0.7 + 0.3,
        baseAlpha: Math.random() * 0.7 + 0.3,
        speedX: (Math.random() - 0.5) * 0.25,
        speedY: (Math.random() - 0.5) * 0.25,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        isAmber: Math.random() < 0.25
      });
    }
  }

  function maybeSpawnShootingStar() {
    if (modes[modeIndex] === 'minimal') return;
    if (Math.random() < 0.015 && shootingStars.length < 3) {
      shootingStars.push({
        x: Math.random() * width * 0.8,
        y: Math.random() * height * 0.4,
        len: Math.random() * 80 + 50,
        speed: Math.random() * 7 + 8,
        angle: (Math.PI / 4) + (Math.random() - 0.5) * 0.2,
        life: 1.0,
        decay: Math.random() * 0.025 + 0.015
      });
    }
  }

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }, { passive: true });
  window.addEventListener('mouseleave', () => {
    mouse.x = -1000;
    mouse.y = -1000;
  }, { passive: true });

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      modeIndex = (modeIndex + 1) % modes.length;
      createStars();
      toggleBtn.classList.toggle('active', modeIndex !== 2);
    });
  }

  resize();

  function animate() {
    ctx.clearRect(0, 0, width, height);

    maybeSpawnShootingStar();

    // Render shooting stars
    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const s = shootingStars[i];
      s.x += Math.cos(s.angle) * s.speed;
      s.y += Math.sin(s.angle) * s.speed;
      s.life -= s.decay;

      if (s.life <= 0) {
        shootingStars.splice(i, 1);
        continue;
      }

      const tailX = s.x - Math.cos(s.angle) * s.len;
      const tailY = s.y - Math.sin(s.angle) * s.len;

      const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
      grad.addColorStop(0, 'rgba(240, 163, 58, 0)');
      grad.addColorStop(0.7, `rgba(240, 163, 58, ${s.life * 0.4})`);
      grad.addColorStop(1, `rgba(255, 255, 255, ${s.life * 0.9})`);

      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
    }

    // Render stars
    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];

      star.x += star.speedX;
      star.y += star.speedY;

      if (star.x < 0) star.x = width;
      if (star.x > width) star.x = 0;
      if (star.y < 0) star.y = height;
      if (star.y > height) star.y = 0;

      star.alpha = star.baseAlpha + Math.sin(Date.now() * star.twinkleSpeed) * 0.25;
      star.alpha = Math.max(0.1, Math.min(1, star.alpha));

      // Mouse interaction
      const dx = mouse.x - star.x;
      const dy = mouse.y - star.y;
      const dist = Math.hypot(dx, dy);
      let renderAlpha = star.alpha;

      if (dist < mouse.radius) {
        const force = (1 - dist / mouse.radius);
        renderAlpha = Math.min(1, star.alpha + force * 0.6);
        ctx.fillStyle = star.isAmber ? `rgba(240, 163, 58, ${renderAlpha})` : `rgba(255, 230, 180, ${renderAlpha})`;
      } else {
        ctx.fillStyle = star.isAmber ? `rgba(240, 163, 58, ${renderAlpha * 0.8})` : `rgba(200, 215, 230, ${renderAlpha * 0.6})`;
      }

      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();

      // Cosmic connections
      if (modes[modeIndex] === 'cosmic') {
        for (let j = i + 1; j < stars.length; j++) {
          const other = stars[j];
          const distBetween = Math.hypot(star.x - other.x, star.y - other.y);
          if (distBetween < 85) {
            const lineAlpha = (1 - distBetween / 85) * 0.12 * star.alpha;
            ctx.strokeStyle = `rgba(240, 163, 58, ${lineAlpha})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(star.x, star.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        }
      }
    }

    requestAnimationFrame(animate);
  }

  animate();
}

// -------------------------------------------------------------
// 6. SCROLL REVEAL ANIMATIONS
// -------------------------------------------------------------
function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    reveals.forEach(el => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view', 'visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  reveals.forEach(el => observer.observe(el));
}

// -------------------------------------------------------------

// -------------------------------------------------------------
// 7. DYNAMIC CACHE-BUSTER (Behringer & Studio / Sequencer URLs)
// -------------------------------------------------------------
// Appends a random ?h=<random> query parameter to all Behringer
// hardware downloads and BCR32 Studio / Sequencer links to bypass
// aggressive CDN / browser caching and force fresh downloads.
function generateRandomHash() {
  const rand = Math.random().toString(36).substring(2, 9);
  const time = Date.now().toString(36);
  return rand + time;
}

function attachCacheBusterToUrl(rawUrl) {
  if (!rawUrl || rawUrl.startsWith('#') || rawUrl.startsWith('javascript:')) return rawUrl;
  try {
    const url = new URL(rawUrl, window.location.href);
    url.searchParams.set('h', generateRandomHash());
    return url.toString();
  } catch (err) {
    const cleanUrl = rawUrl.replace(/([?&])h=[^&#]*/, '');
    const sep = cleanUrl.includes('?') ? '&' : '?';
    return ;
  }
}

function shouldBypassCache(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes('behringer.com') ||
         lower.includes('thelazygeekguy.github.io') ||
         lower.includes('bcr32-studio');
}

function refreshAllCacheBustingLinks() {
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (shouldBypassCache(href)) {
      link.href = attachCacheBusterToUrl(href);
    }
  });
}

function initCacheBuster() {
  // 1. Initial pass on page load
  refreshAllCacheBustingLinks();

  // 2. Refresh link dynamically on click, pointerdown, auxclick, focus, hover
  // Guarantees that every single navigation uses a brand-new unique hash.
  const triggerEvents = ['pointerdown', 'mousedown', 'click', 'auxclick', 'focus', 'pointerenter'];
  triggerEvents.forEach(evtType => {
    document.addEventListener(evtType, e => {
      if (!e.target || typeof e.target.closest !== 'function') return;
      const link = e.target.closest('a[href]');
      if (!link) return;
      const href = link.getAttribute('href');
      if (shouldBypassCache(href)) {
        link.href = attachCacheBusterToUrl(href);
      }
    }, { capture: true, passive: true });
  });

  // 3. Periodic refresh every 15 seconds
  setInterval(refreshAllCacheBustingLinks, 15000);
}

// DOM READY INITIALIZATION
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initI18n();
  initProductSwitch();
  initWorkflowRoute();
  initModal();
  initStarfield();
  initScrollReveal();
  initCacheBuster();
});
