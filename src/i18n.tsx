import { cloneElement, createContext, isValidElement, useContext, useEffect, useState, type ReactNode, type ReactElement } from 'react'
import { statusRows } from './i18n-status'
import { Icon } from './Icon'
export const languages = [{ id: 'en', name: 'English' }, { id: 'fr', name: 'Français' }, { id: 'it', name: 'Italiano' }, { id: 'de', name: 'Deutsch' }, { id: 'ja', name: '日本語' }, { id: 'es', name: 'Español' }, { id: 'ru', name: 'Русский' }, { id: 'zh', name: '简体中文' }] as const
export type Language = typeof languages[number]['id']
export type LanguageChoice = Language | 'auto'
export const languageKey = 'bcr32-studio.language.v1'
export const parseLanguage = (value: unknown): Language => languages.some(l => l.id === value) ? value as Language : 'en'
export function detectLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const base = tag.toLowerCase().replace('_', '-').split('-')[0]
    if (languages.some(l => l.id === base)) return base as Language
  }
  return 'en'
}
export function browserLanguage(): Language { try { return detectLanguage(navigator.languages?.length ? navigator.languages : [navigator.language]) } catch { return 'en' } }
export function loadLanguageChoice(): LanguageChoice { try { const saved = window.localStorage.getItem(languageKey); return languages.some(l => l.id === saved) ? saved as Language : 'auto' } catch { return 'auto' } }
export function loadLanguage(): Language { const choice = loadLanguageChoice(); return choice === 'auto' ? browserLanguage() : choice }
export const I18nContext = createContext<{ language: Language; choice: LanguageChoice; setChoice: (choice: LanguageChoice) => void }>({ language: 'en', choice: 'auto', setChoice: () => {} })
const Context = I18nContext // Exported so tests can force a language without localStorage or navigator.
export const useLanguage = () => useContext(Context).language
// Columns: English (source and key) | French | Italian | German | Japanese | Spanish | Russian | Simplified Chinese.
// Slots {name} {count} {file} are copied verbatim; {detail} is translated recursively.
const rows = [
  'Automatic · browser|Automatique · navigateur|Automatico · browser|Automatisch · Browser|自動 · ブラウザー|Automático · navegador|Автоматически · браузер|自动 · 浏览器',
  'MIDI reception available after connection; CC sending disabled. Hardware configuration locked.|Réception MIDI disponible après connexion ; émission CC désactivée. Configuration matérielle verrouillée.|Ricezione MIDI dopo la connessione; invio CC disattivato. Configurazione hardware bloccata.|MIDI-Empfang nach Verbindung; CC-Senden deaktiviert. Hardwarekonfiguration gesperrt.|接続後にMIDI受信可能。CC送信は無効。ハードウェア設定はロックされています。|Recepción MIDI tras conectar; envío CC desactivado. Configuración de hardware bloqueada.|Приём MIDI после подключения; передача CC отключена. Настройки устройства заблокированы.|连接后可接收MIDI；CC发送已关闭。设备配置已锁定。',
  'Provisional push: physical presence and MIDI mapping unconfirmed.|Push provisoire : présence physique et correspondance MIDI à confirmer.|Pressione provvisoria: presenza fisica e mappatura MIDI da confermare.|Vorläufiger Druck: physische Funktion und MIDI-Zuordnung unbestätigt.|仮の押下機能：実機の有無とMIDI対応は未確認です。|Pulsación provisional: presencia física y correspondencia MIDI sin confirmar.|Предварительное нажатие: наличие и MIDI-соответствие не подтверждены.|临时按压功能：硬件是否支持及MIDI映射尚未确认。',
  'Clicking the panel only selects a control.|Le clic sur la façade reste une sélection.|Il clic sul pannello seleziona solo il controllo.|Ein Klick auf die Oberfläche wählt nur das Bedienelement.|パネルのクリックは選択のみです。|El clic en el panel solo selecciona un control.|Щелчок по панели только выбирает элемент.|点击面板仅选择控件。',
  'Permission to use Web MIDI API was not granted.|Autorisation Web MIDI refusée par le navigateur.|Autorizzazione Web MIDI non concessa.|Web-MIDI-Berechtigung nicht erteilt.|Web MIDIの使用は許可されませんでした。|No se concedió permiso para Web MIDI.|Разрешение на использование Web MIDI не предоставлено.|未获得使用Web MIDI的权限。',
  'Control|Contrôle|Controllo|Steuerung|コントロール|Control|Управление|控制',
  'Presets|Presets|Preset|Presets|プリセット|Presets|Пресеты|预设',
  'Files|Fichiers|File|Dateien|ファイル|Archivos|Файлы|文件',
  'Log|Journal|Registro|Protokoll|ログ|Registro|Журнал|日志',
  'Language|Langue|Lingua|Sprache|言語|Idioma|Язык|语言',
  'Selection ·|Sélection ·|Selezione ·|Auswahl ·|選択 ·|Selección ·|Выбрано ·|已选择 ·',
  'Single|Une seule|Singola|Einzeln|単一|Individual|Один|单选',
  'Multi-select|Multi-sélection|Selezione multipla|Mehrfachauswahl|複数選択|Selección múltiple|Множественный выбор|多选',
  'Drag on the background: rectangle selection.|Glisser sur le fond : sélection par rectangle.|Trascina sullo sfondo: selezione rettangolare.|Auf dem Hintergrund ziehen: Rechteckauswahl.|背景をドラッグ：矩形選択。|Arrastra sobre el fondo: selección rectangular.|Перетащите по фону: выделение прямоугольником.|在背景上拖动：框选。',
  'Click: add / remove|Clic : ajouter / retirer|Clic: aggiungi / rimuovi|Klick: hinzufügen / entfernen|クリック：追加 / 解除|Clic: añadir / quitar|Щелчок: добавить / убрать|点击：添加 / 移除',
  'Mixed|Mixte|Misto|Gemischt|混在|Mixto|Разные|混合',
  'Mixed / batch label|Mixte · étiquette du groupe|Misto / etichetta del gruppo|Gemischt / Gruppenname|混在 / グループ名|Mixto / etiqueta del grupo|Разные / имя группы|混合 / 组标签',
  'MIDI ready|MIDI prêt|MIDI pronto|MIDI bereit|MIDI準備完了|MIDI listo|MIDI готов|MIDI已就绪',
  'automatic connection|connexion automatique|connessione automatica|automatische Verbindung|自動接続|conexión automática|автоматическое подключение|自动连接',
  'Retry MIDI + SysEx|Réessayer MIDI + SysEx|Riprova MIDI + SysEx|MIDI + SysEx erneut versuchen|MIDI + SysExを再試行|Reintentar MIDI + SysEx|Повторить MIDI + SysEx|重试MIDI + SysEx',
  'Send CC to BCR32|Envoyer les CC au BCR32|Invia CC al BCR32|CC an BCR32 senden|BCR32にCCを送信|Enviar CC al BCR32|Отправлять CC на BCR32|向BCR32发送CC',
  'CC sending on · disable|Émission CC active · désactiver|Invio CC attivo · disattiva|CC-Senden aktiv · deaktivieren|CC送信中 · 無効にする|Envío CC activo · desactivar|Передача CC включена · отключить|CC发送已启用 · 关闭',
  'Load preset|Charger un preset|Carica preset|Preset laden|プリセットを読み込む|Cargar preset|Загрузить пресет|加载预设',
  'Draft · choose a preset|Brouillon · choisir un preset|Bozza · scegli un preset|Entwurf · Preset wählen|下書き · プリセットを選択|Borrador · elegir preset|Черновик · выбрать пресет|草稿 · 选择预设',
  'Preset name|Nom du preset|Nome del preset|Preset-Name|プリセット名|Nombre del preset|Название пресета|预设名称',
  'Create preset|Créer le preset|Crea preset|Preset erstellen|プリセットを作成|Crear preset|Создать пресет|创建预设',
  'Save / rename|Sauvegarder / renommer|Salva / rinomina|Speichern / umbenennen|保存 / 名前変更|Guardar / renombrar|Сохранить / переименовать|保存 / 重命名',
  'Save as new|Sauver comme nouveau|Salva come nuovo|Als neu speichern|新規として保存|Guardar como nuevo|Сохранить как новый|另存为新预设',
  'Load the settings from the BCR32 at connection|Charger les réglages du BCR32 à la connexion|Carica le impostazioni dal BCR32 alla connessione|Einstellungen beim Verbinden vom BCR32 laden|接続時にBCR32から設定を読み込む|Cargar los ajustes del BCR32 al conectar|Загружать настройки из BCR32 при подключении|连接时从 BCR32 载入设置',
  'Reset to editor defaults|Rétablir les valeurs par défaut de l’éditeur|Ripristina i valori predefiniti dell’editor|Auf Editor-Standardwerte zurücksetzen|エディターの既定値に戻す|Restablecer los valores predeterminados del editor|Сбросить к значениям редактора по умолчанию|恢复编辑器默认值',
  'Read from the BCR32 at {detail}.|Lu sur le BCR32 à {detail}.|Letto dal BCR32 alle {detail}.|Um {detail} vom BCR32 gelesen.|{detail}にBCR32から読み取りました。|Leído del BCR32 a las {detail}.|Прочитано из BCR32 в {detail}.|于 {detail} 从 BCR32 读取。',
  'Changes here stay in the editor: writing to the BCR32 is not available yet.|Les modifications faites ici restent dans l’éditeur : l’écriture vers le BCR32 n’est pas encore disponible.|Le modifiche qui restano nell’editor: la scrittura sul BCR32 non è ancora disponibile.|Änderungen hier bleiben im Editor: Schreiben auf den BCR32 ist noch nicht verfügbar.|ここでの変更はエディター内に留まります。BCR32への書き込みはまだできません。|Los cambios aquí se quedan en el editor: la escritura en el BCR32 aún no está disponible.|Изменения здесь остаются в редакторе: запись в BCR32 пока недоступна.|此处的更改仅保留在编辑器中：尚不能写入 BCR32。',
  'Differs from the value read on the BCR32|Diffère de la valeur lue sur le BCR32|Diverso dal valore letto sul BCR32|Weicht vom am BCR32 gelesenen Wert ab|BCR32から読み取った値と異なります|Difiere del valor leído en el BCR32|Отличается от значения, прочитанного из BCR32|与从 BCR32 读取的值不同',
  'Values read from the BCR32 and chosen here. Write sends a changed value to the BCR32, then reads it back.|Valeurs lues sur le BCR32 et choisies ici. « Écrire » envoie une valeur modifiée au BCR32, puis la relit.|Valori letti dal BCR32 e scelti qui. Scrivi invia un valore modificato al BCR32, poi lo rilegge.|Vom BCR32 gelesene und hier gewählte Werte. Schreiben sendet einen geänderten Wert an den BCR32 und liest ihn zurück.|BCR32から読み取り、ここで選択した値です。「書き込む」は変更した値をBCR32に送り、読み返します。|Valores leídos del BCR32 y elegidos aquí. Escribir envía un valor modificado al BCR32 y luego lo vuelve a leer.|Значения, прочитанные из BCR32 и выбранные здесь. «Записать» отправляет изменённое значение в BCR32 и читает его обратно.|从 BCR32 读取并在此选择的值。“写入”会把修改后的值发送到 BCR32，然后回读。',
  'Write|Écrire|Scrivi|Schreiben|書き込む|Escribir|Записать|写入',
  'Write…|Écrire…|Scrivi…|Schreiben…|書き込む…|Escribir…|Записать…|写入…',
  'Confirm|Confirmer|Conferma|Bestätigen|確認|Confirmar|Подтвердить|确认',
  'Write all changes|Écrire toutes les modifications|Scrivi tutte le modifiche|Alle Änderungen schreiben|すべての変更を書き込む|Escribir todos los cambios|Записать все изменения|写入所有更改',
  'Writing…|Écriture…|Scrittura…|Wird geschrieben…|書き込み中…|Escribiendo…|Запись…|正在写入…',
  'Written and read back|Écrit et relu|Scritto e riletto|Geschrieben und zurückgelesen|書き込み・読み返し済み|Escrito y releído|Записано и прочитано|已写入并回读',
  'Read-back differs|La relecture diffère|La rilettura è diversa|Rücklesen weicht ab|読み返しの値が異なります|La relectura difiere|Прочитанное значение отличается|回读值不同',
  'No reply|Pas de réponse|Nessuna risposta|Keine Antwort|応答なし|Sin respuesta|Нет ответа|无响应',
  'This setting can cut the USB link with the editor; it can be restored from the front panel.|Ce réglage peut couper la liaison USB avec l’éditeur ; il se rétablit depuis la façade.|Questa impostazione può interrompere il collegamento USB con l’editor; si ripristina dal pannello frontale.|Diese Einstellung kann die USB-Verbindung zum Editor trennen; sie lässt sich am Bedienfeld wiederherstellen.|この設定はエディターとのUSB接続を切ることがあります。フロントパネルから元に戻せます。|Este ajuste puede cortar el enlace USB con el editor; se restablece desde el panel frontal.|Этот параметр может разорвать USB-связь с редактором; его можно восстановить с передней панели.|此设置可能会切断与编辑器的 USB 连接；可在前面板上恢复。',
  'Device settings|Réglages de l’appareil|Impostazioni del dispositivo|Geräteeinstellungen|デバイス設定|Ajustes del dispositivo|Настройки устройства|设备设置',
  'Read from the BCR32|Lire depuis le BCR32|Leggi dal BCR32|Vom BCR32 lesen|BCR32から読み取る|Leer del BCR32|Прочитать из BCR32|从 BCR32 读取',
  'Reading…|Lecture…|Lettura…|Wird gelesen…|読み取り中…|Leyendo…|Чтение…|正在读取…',
  'Setting|Réglage|Impostazione|Einstellung|設定|Ajuste|Параметр|设置',
  'Value|Valeur|Valore|Wert|値|Valor|Значение|值',
  'Bootloader status|État du bootloader|Stato del bootloader|Bootloader-Status|ブートローダーの状態|Estado del bootloader|Состояние загрузчика|引导程序状态',
  'Footswitch 1|Pédale 1|Pedale 1|Fußschalter 1|フットスイッチ1|Pedal 1|Педаль 1|脚踏开关 1',
  'Footswitch 2|Pédale 2|Pedale 2|Fußschalter 2|フットスイッチ2|Pedal 2|Педаль 2|脚踏开关 2',
  'MIDI thru source|Source MIDI thru|Sorgente MIDI thru|MIDI-Thru-Quelle|MIDIスルーのソース|Fuente MIDI thru|Источник MIDI thru|MIDI 直通来源',
  'MIDI thru destination|Destination MIDI thru|Destinazione MIDI thru|MIDI-Thru-Ziel|MIDIスルーの出力先|Destino MIDI thru|Назначение MIDI thru|MIDI 直通目标',
  'Operating mode|Mode de fonctionnement|Modalità operativa|Betriebsmodus|動作モード|Modo de funcionamiento|Режим работы|工作模式',
  'Controller output port|Port de sortie Controller|Porta di uscita Controller|Controller-Ausgangsport|コントローラー出力ポート|Puerto de salida Controller|Выходной порт Controller|控制器输出端口',
  'Start on|Démarrage sur|Avvio su|Start auf|起動時|Inicio en|Запуск в|启动于',
  'Clock rate out|Fréquence d’horloge en sortie|Frequenza clock in uscita|Ausgangs-Clockrate|クロック出力レート|Frecuencia de reloj de salida|Частота выходного клока|输出时钟速率',
  'Sync mode|Mode de synchronisation|Modalità di sincronizzazione|Sync-Modus|同期モード|Modo de sincronización|Режим синхронизации|同步模式',
  'Clock output port|Port de sortie d’horloge|Porta di uscita clock|Clock-Ausgangsport|クロック出力ポート|Puerto de salida de reloj|Порт выхода клока|时钟输出端口',
  'Scale|Gamme|Scala|Skala|スケール|Escala|Лад|音阶',
  'Scale base|Tonique de la gamme|Tonica della scala|Grundton der Skala|スケールの基音|Tónica de la escala|Тоника лада|音阶主音',
  'Transpose mode|Mode de transposition|Modalità di trasposizione|Transpositionsmodus|トランスポーズモード|Modo de transposición|Режим транспонирования|移调模式',
  'Trigger mode|Mode de déclenchement|Modalità trigger|Trigger-Modus|トリガーモード|Modo de disparo|Режим запуска|触发模式',
  'Quantization mode|Mode de quantification|Modalità di quantizzazione|Quantisierungsmodus|クオンタイズモード|Modo de cuantización|Режим квантования|量化模式',
  'Quantization mixer|Mixeur de quantification|Mixer di quantizzazione|Quantisierungsmixer|クオンタイズミキサー|Mezclador de cuantización|Микшер квантования|量化混合',
  'Display style|Style d’écran|Stile del display|Displaystil|ディスプレイのスタイル|Estilo de pantalla|Стиль экрана|显示屏样式',
  'Ice OLED|OLED glacier|OLED ghiaccio|Eis-OLED|アイスOLED|OLED hielo|Ледяной OLED|冰蓝 OLED',
  'Amber VFD|VFD ambre|VFD ambra|Bernstein-VFD|アンバーVFD|VFD ámbar|Янтарный VFD|琥珀 VFD',
  'Green LCD|LCD vert|LCD verde|Grünes LCD|グリーンLCD|LCD verde|Зелёный ЖК|绿色 LCD',
  'Red LED|LED rouge|LED rosso|Rote LED|赤色LED|LED rojo|Красный LED|红色 LED',
  'White OLED|OLED blanc|OLED bianco|Weißes OLED|ホワイトOLED|OLED blanco|Белый OLED|白色 OLED',
  'Label screen|Écran d’étiquette|Schermo etichetta|Beschriftungsanzeige|ラベル表示|Pantalla de etiqueta|Экран метки|标签显示屏',
  'Label|Étiquette|Etichetta|Beschriftung|ラベル|Etiqueta|Метка|标签',
  'Show control numbers|Afficher les numéros des contrôles|Mostra i numeri dei controlli|Nummern der Bedienelemente anzeigen|コントロール番号を表示|Mostrar los números de los controles|Показывать номера элементов|显示控件编号',
  'Zoom while adjusting|Zoom à la manipulation|Zoom durante la regolazione|Zoom beim Einstellen|操作時にズーム|Zoom al ajustar|Увеличение при настройке|调节时放大',
  'Export draft JSON|Exporter le brouillon JSON|Esporta bozza JSON|Entwurf als JSON exportieren|下書きをJSONで書き出す|Exportar borrador JSON|Экспорт черновика JSON|导出草稿JSON',
  'Import preset / bank|Importer preset / banque|Importa preset / banco|Preset / Bank importieren|プリセット / バンクを読み込む|Importar preset / banco|Импорт пресета / банка|导入预设 / 预设库',
  'Export library|Exporter la bibliothèque|Esporta libreria|Bibliothek exportieren|ライブラリを書き出す|Exportar biblioteca|Экспорт библиотеки|导出预设库',
  'Preparing PDF…|Préparation du PDF…|Preparazione PDF…|PDF wird erstellt…|PDFを作成中…|Preparando PDF…|Подготовка PDF…|正在生成PDF…',
  'Download A4 PDF sheet|Télécharger la fiche A4 PDF|Scarica scheda PDF A4|A4-PDF herunterladen|A4 PDFシートをダウンロード|Descargar ficha PDF A4|Скачать лист A4 PDF|下载A4 PDF参考表',
  'Cubase · MIDI Remote|Cubase · MIDI Remote|Cubase · MIDI Remote|Cubase · MIDI Remote|Cubase · MIDI Remote|Cubase · MIDI Remote|Cubase · MIDI Remote|Cubase · MIDI Remote',
  'Surface script for Cubase 12 and later: encoders, pushes and buttons with their exact MIDI messages. No function is assigned: map them in Cubase with the Mapping Assistant.|Script de surface pour Cubase 12 et suivants : encodeurs, push et touches avec leurs messages MIDI exacts. Aucune fonction n’est affectée : les lier dans Cubase avec l’assistant de mapping.|Script di superficie per Cubase 12 e successivi: encoder, push e tasti con i loro messaggi MIDI esatti. Nessuna funzione assegnata: collegarle in Cubase con il Mapping Assistant.|Oberflächenskript für Cubase 12 und neuer: Encoder, Pushes und Tasten mit ihren genauen MIDI-Nachrichten. Keine Funktion zugewiesen: in Cubase mit dem Mapping Assistant zuweisen.|Cubase 12以降用のサーフェススクリプト：エンコーダー、プッシュ、ボタンとその正確なMIDIメッセージ。機能は割り当てられていません：CubaseのMapping Assistantで割り当ててください。|Script de superficie para Cubase 12 y posteriores: encoders, pulsadores y botones con sus mensajes MIDI exactos. No se asigna ninguna función: asígnelas en Cubase con el Mapping Assistant.|Скрипт поверхности для Cubase 12 и новее: энкодеры, нажатия и кнопки с точными MIDI-сообщениями. Функции не назначены: назначьте их в Cubase через Mapping Assistant.|适用于 Cubase 12 及更高版本的控制面脚本：编码器、按压和按键及其精确的 MIDI 消息。未分配任何功能：请在 Cubase 中用 Mapping Assistant 分配。',
  'Export Cubase script|Exporter le script Cubase|Esporta script Cubase|Cubase-Skript exportieren|Cubaseスクリプトを書き出す|Exportar script de Cubase|Экспорт скрипта Cubase|导出 Cubase 脚本',
  'Legacy profile format|Ancien format profil|Formato profilo precedente|Altes Profilformat|旧プロファイル形式|Formato de perfil anterior|Старый формат профиля|旧版配置格式',
  'Export profile v2|Exporter profil v2|Esporta profilo v2|Profil v2 exportieren|プロファイルv2を書き出す|Exportar perfil v2|Экспорт профиля v2|导出v2配置',
  'Import profile v1/v2|Importer profil v1/v2|Importa profilo v1/v2|Profil v1/v2 importieren|プロファイルv1/v2を読み込む|Importar perfil v1/v2|Импорт профиля v1/v2|导入v1/v2配置',
  'PROGRAMMABLE BUTTON|TOUCHE PROGRAMMABLE|PULSANTE PROGRAMMABILE|PROGRAMMIERBARE TASTE|プログラム可能なボタン|BOTÓN PROGRAMABLE|ПРОГРАММИРУЕМАЯ КНОПКА|可编程按键',
  'SELECTED ENCODER|ENCODEUR SÉLECTIONNÉ|ENCODER SELEZIONATO|AUSGEWÄHLTER ENCODER|選択したエンコーダー|ENCODER SELECCIONADO|ВЫБРАННЫЙ ЭНКОДЕР|当前编码器',
  'Encoder|Encodeur|Encoder|Encoder|エンコーダー|Encoder|Энкодер|编码器',
  'Button|Bouton|Pulsante|Taste|ボタン|Botón|Кнопка|按键',
  'Visual label|Étiquette visuelle|Etichetta visiva|Beschriftung|表示ラベル|Etiqueta visual|Подпись|显示标签',
  'Default printed name|Nom imprimé par défaut|Nome stampato predefinito|Standardbeschriftung|標準の印字名|Nombre impreso por defecto|Стандартная подпись|默认印字名称',
  'Rotation|Rotation|Rotazione|Drehung|回転|Rotación|Вращение|旋转',
  'Push|Push|Pressione|Druck|押下|Pulsación|Нажатие|按压',
  'Value ·|Valeur ·|Valore ·|Wert ·|値 ·|Valor ·|Значение ·|数值 ·',
  'relative estimate|estimation relative|stima relativa|relative Schätzung|相対値の推定|estimación relativa|относительная оценка|相对值估算',
  'MIDI received|MIDI reçu|MIDI ricevuto|MIDI empfangen|MIDI受信|MIDI recibido|Получено по MIDI|MIDI接收值',
  'UI adjustment|geste IHM|regolazione UI|UI-Einstellung|UI操作|ajuste de interfaz|Настройка в интерфейсе|界面调节',
  'local preview|aperçu local|anteprima locale|lokale Vorschau|ローカルプレビュー|vista previa local|Локальный просмотр|本地预览',
  'Encoder value|Valeur de l’encodeur|Valore encoder|Encoder-Wert|エンコーダーの値|Valor del encoder|Значение энкодера|编码器数值',
  'LED ring|Anneau LED|Anello LED|LED-Ring|LEDリング|Anillo LED|Кольцо LED|LED灯环',
  'Bar|Barre|Barra|Balken|バー|Barra|Шкала|条形',
  'Dot|Point|Punto|Punkt|点|Punto|Точка|单点',
  'Type|Type|Tipo|Typ|種類|Tipo|Тип|类型',
  'Mode|Mode|Modalità|Modus|モード|Modo|Режим|模式',
  'Channel|Canal|Canale|Kanal|チャンネル|Canal|Канал|通道',
  'CC / Parameter|CC / Paramètre|CC / Parametro|CC / Parameter|CC / パラメーター|CC / Parámetro|CC / Параметр|CC / 参数',
  'Minimum|Minimum|Minimo|Minimum|最小値|Mínimo|Минимум|最小值',
  'Maximum|Maximum|Massimo|Maximum|最大値|Máximo|Максимум|最大值',
  'Step per press|Pas par appui|Passo per pressione|Schritt pro Druck|押下ごとの増分|Paso por pulsación|Шаг за нажатие|每次按压步长',
  'Test press / release|Tester l’appui / relâchement|Prova pressione / rilascio|Drücken / Loslassen testen|押下 / 解放をテスト|Probar pulsación / liberación|Тест нажатия / отпускания|测试按下 / 松开',
  'WEB MIDI TRANSPORT|TRANSPORT WEB MIDI|TRASPORTO WEB MIDI|WEB-MIDI-VERBINDUNG|WEB MIDI通信|TRANSPORTE WEB MIDI|СВЯЗЬ WEB MIDI|WEB MIDI通信',
  'Connection and probe|Connexion et sonde|Connessione e sonda|Verbindung und Abfrage|接続と問い合わせ|Conexión y sondeo|Подключение и опрос|连接与查询',
  'SysEx allowed|SysEx autorisé|SysEx autorizzato|SysEx erlaubt|SysEx許可済み|SysEx autorizado|SysEx разрешён|SysEx已授权',
  'SysEx not granted|SysEx non accordé|SysEx non autorizzato|SysEx nicht erlaubt|SysEx未許可|SysEx no autorizado|SysEx не разрешён|SysEx未授权',
  'Input|Entrée|Ingresso|Eingang|入力|Entrada|Вход|输入',
  'Output|Sortie|Uscita|Ausgang|出力|Salida|Выход|输出',
  'Choose…|Choisir…|Scegli…|Wählen…|選択…|Elegir…|Выбрать…|选择…',
  'MIDI LOG|JOURNAL MIDI|REGISTRO MIDI|MIDI-PROTOKOLL|MIDIログ|REGISTRO MIDI|ЖУРНАЛ MIDI|MIDI日志',
  'Recent messages|Dernières trames|Messaggi recenti|Letzte Nachrichten|最近のメッセージ|Mensajes recientes|Последние сообщения|最近消息',
  'No messages received.|Aucune trame reçue.|Nessun messaggio ricevuto.|Keine Nachrichten empfangen.|メッセージ未受信。|No se han recibido mensajes.|Сообщений пока нет.|尚未收到消息。',
  'Undefined|Non défini|Non definito|Nicht definiert|未定義|Sin definir|Не задано|未定义',
  'Choose / name…|Choisir / nommer…|Scegli / nomina…|Wählen / benennen…|選択 / 名前を付ける…|Elegir / nombrar…|Выбрать / назвать…|选择 / 命名…',
  'No parameter number|Sans numéro de paramètre|Senza numero di parametro|Ohne Parameternummer|パラメーター番号なし|Sin número de parámetro|Без номера параметра|无参数编号',
  'Search parameters|Rechercher un paramètre|Cerca parametri|Parameter suchen|パラメーター検索|Buscar parámetros|Поиск параметров|搜索参数',
  'Number or name|Numéro ou nom|Numero o nome|Nummer oder Name|番号または名前|Número o nombre|Номер или имя|编号或名称',
  'Name|Nommer|Nomina|Benennen|命名|Nombrar|Назвать|命名',
  'Local parameter name|Nom local du paramètre|Nome locale del parametro|Lokaler Parametername|ローカルパラメーター名|Nombre local del parámetro|Локальное имя параметра|本地参数名称',
  'Save name|Enregistrer le nom|Salva nome|Namen speichern|名前を保存|Guardar nombre|Сохранить имя|保存名称',
  'Parameter names ·|Noms des paramètres ·|Nomi dei parametri ·|Parameternamen ·|パラメーター名 ·|Nombres de parámetros ·|Имена параметров ·|参数名称 ·',
  'Export table JSON|Exporter la table JSON|Esporta tabella JSON|Tabelle als JSON exportieren|テーブルをJSONで書き出す|Exportar tabla JSON|Экспорт таблицы JSON|导出参数表JSON',
  'Import table JSON|Importer une table JSON|Importa tabella JSON|JSON-Tabelle importieren|JSONテーブルを読み込む|Importar tabla JSON|Импорт таблицы JSON|导入参数表JSON',
  'Restore default names|Rétablir les noms par défaut|Ripristina nomi predefiniti|Standardnamen wiederherstellen|標準名に戻す|Restaurar nombres por defecto|Восстановить стандартные имена|恢复默认名称',
  'All|Tout|Tutto|Alle|すべて|Todo|Все|全部',
  'None|Aucun|Nessuno|Keine|なし|Ninguno|Ни одного|全不选',
  'Cancel|Annuler|Annulla|Abbrechen|キャンセル|Cancelar|Отмена|取消',
  'Import|Importer|Importa|Importieren|読み込む|Importar|Импортировать|导入',
  'entries|entrées|voci|Einträge|件|entradas|записей|条目',
  'Replace local names with defaults?|Remplacer les noms locaux par la table par défaut ?|Sostituire i nomi locali con quelli predefiniti?|Lokale Namen durch Standardnamen ersetzen?|ローカル名を標準名に置き換えますか？|¿Reemplazar nombres locales por los predeterminados?|Заменить локальные имена стандартными?|将本地名称替换为默认名称？',
  'Instrument-specific table: add a name or import a table.|Table propre à l’instrument : ajouter un nom ou importer une table.|Tabella specifica dello strumento: aggiungi un nome o importa una tabella.|Instrumentenspezifische Tabelle: Namen hinzufügen oder Tabelle importieren.|機器固有のテーブル：名前を追加するかテーブルを読み込んでください。|Tabla del instrumento: añade un nombre o importa una tabla.|Таблица инструмента: добавьте имя или импортируйте таблицу.|此表因乐器而异：请添加名称或导入参数表。',
  'Sending only when enabled; no configuration writes.|Émission sur activation, aucune écriture de configuration.|Invio solo se attivato; nessuna scrittura di configurazione.|Senden nur bei Aktivierung; keine Konfigurationsänderung.|有効時のみ送信。設定の書き込みは行いません。|Envío solo al activarlo; sin escritura de configuración.|Передача только при включении; без записи конфигурации.|仅在启用后发送，不写入设备配置。',
  'Receive / local preview · CC sending disabled.|Réception / aperçu local · émission CC désactivée.|Ricezione / anteprima locale · invio CC disattivato.|Empfang / lokale Vorschau · CC-Senden deaktiviert.|受信 / ローカルプレビュー · CC送信無効。|Recepción / vista previa local · envío CC desactivado.|Приём / локальный просмотр · передача CC отключена.|接收 / 本地预览 · CC发送已关闭。',
  'CC values sent · assignments unchanged.|Valeurs CC envoyées · assignations non modifiées.|Valori CC inviati · assegnazioni invariate.|CC-Werte gesendet · Zuweisungen unverändert.|CC値を送信 · 割り当ては変更しません。|Valores CC enviados · asignaciones sin cambios.|Значения CC отправлены · назначения не изменены.|已发送CC数值 · 分配保持不变。',
  'Receive: matching channel and CC/NRPN parameter.|Réception : même canal et paramètre CC/NRPN.|Ricezione: stesso canale e parametro CC/NRPN.|Empfang: gleicher Kanal und CC/NRPN-Parameter.|受信：同じチャンネルとCC/NRPNパラメーター。|Recepción: mismo canal y parámetro CC/NRPN.|Приём: совпадающий канал и параметр CC/NRPN.|接收：通道和CC/NRPN参数必须匹配。',
  // Rows below serve components translatedTree never reaches (FrontPanel, OledDisplay, ActivityLeds, StudioConfig, ControlSearch).
  'Rename {name}|Renommer {name}|Rinomina {name}|{name} umbenennen|{name}の名前を変更|Renombrar {name}|Переименовать {name}|重命名{name}',
  'Empty = original name|Vide = nom d’origine|Vuoto = nome originale|Leer = ursprünglicher Name|空欄 = 元の名前|Vacío = nombre original|Пусто = исходное имя|留空 = 原始名称',
  'Enter or click elsewhere: confirm. Esc: cancel.|Entrée ou clic ailleurs : valider. Échap : annuler.|Invio o clic altrove: conferma. Esc: annulla.|Eingabe oder Klick außerhalb: bestätigen. Esc: abbrechen.|Enterまたは他をクリック：確定。Esc：キャンセル。|Intro o clic fuera: confirmar. Esc: cancelar.|Enter или щелчок в стороне: подтвердить. Esc: отмена.|回车或点击其他位置：确认。Esc：取消。',
  'assigned|assigné|assegnato|zugewiesen|割り当て済み|asignado|назначено|已分配',
  'local profile|profil local|profilo locale|lokales Profil|ローカルプロファイル|perfil local|локальный профиль|本地配置',
  'Interactive BCR32 front panel|Façade interactive du BCR32|Pannello frontale interattivo BCR32|Interaktive Frontplatte des BCR32|BCR32のインタラクティブなフロントパネル|Panel frontal interactivo del BCR32|Интерактивная передняя панель BCR32|BCR32交互式前面板',
  'Encoder label|Étiquette encodeur|Etichetta encoder|Encoder-Beschriftung|エンコーダーラベル|Etiqueta del encoder|Подпись энкодера|编码器标签',
  'Push label|Étiquette push|Etichetta pressione|Druck-Beschriftung|押下ラベル|Etiqueta de pulsación|Подпись нажатия|按压标签',
  'Click: select. Double-click or F2: rename.|Simple clic : sélectionner. Double-clic ou F2 : renommer.|Clic: seleziona. Doppio clic o F2: rinomina.|Klick: auswählen. Doppelklick oder F2: umbenennen.|クリック：選択。ダブルクリックまたはF2：名前変更。|Clic: seleccionar. Doble clic o F2: renombrar.|Щелчок: выбрать. Двойной щелчок или F2: переименовать.|单击：选择。双击或F2：重命名。',
  'Double-click or F2: rename the push|Double-clic ou F2 : renommer le push|Doppio clic o F2: rinomina la pressione|Doppelklick oder F2: Druck umbenennen|ダブルクリックまたはF2：押下の名前変更|Doble clic o F2: renombrar la pulsación|Двойной щелчок или F2: переименовать нажатие|双击或F2：重命名按压',
  'rotation|rotation|rotazione|Drehung|回転|rotación|вращение|旋转',
  'push|push|pressione|Druck|押下|pulsación|нажатие|按压',
  'hardware presence unconfirmed|présence matérielle à confirmer|presenza hardware da confermare|Hardware-Vorhandensein unbestätigt|実機の有無は未確認|presencia física sin confirmar|наличие в устройстве не подтверждено|硬件是否支持尚未确认',
  'SELECT rotation and push|SELECT rotation et push|SELECT rotazione e pressione|SELECT Drehung und Druck|SELECT 回転と押下|SELECT rotación y pulsación|SELECT вращение и нажатие|SELECT 旋转与按压',
  'hardware command not enabled|commande matérielle non activée|comando hardware non attivato|Hardwarebefehl nicht aktiviert|ハードウェアコマンドは無効|comando de hardware no activado|аппаратная команда не включена|硬件命令未启用',
  '{name} shown: no hardware command sent.|{name} représenté : aucune commande matérielle envoyée.|{name} rappresentato: nessun comando hardware inviato.|{name} dargestellt: kein Hardwarebefehl gesendet.|{name}は表示のみ：ハードウェアコマンドは送信されません。|{name} representado: ningún comando de hardware enviado.|{name} отображён: аппаратная команда не отправлена.|{name}仅为显示：未发送硬件命令。',
  'SELECT shown: no hardware command enabled.|SELECT représenté : aucune commande matérielle activée.|SELECT rappresentato: nessun comando hardware attivato.|SELECT dargestellt: kein Hardwarebefehl aktiviert.|SELECTは表示のみ：ハードウェアコマンドは無効。|SELECT representado: ningún comando de hardware activado.|SELECT отображён: аппаратная команда не включена.|SELECT仅为显示：未启用硬件命令。',
  'Editor Controller mode only. No hardware change.|Mode Controller de l’éditeur uniquement. Aucun changement matériel.|Solo modalità Controller dell’editor. Nessuna modifica hardware.|Nur Controller-Modus des Editors. Keine Hardwareänderung.|エディターのControllerモードのみ。ハードウェアは変更されません。|Solo modo Controller del editor. Sin cambios en el hardware.|Только режим Controller редактора. Без изменений в устройстве.|仅编辑器Controller模式。硬件无变化。',
  'Enter the OLED value|Saisir la valeur OLED|Inserisci il valore OLED|OLED-Wert eingeben|OLEDの値を入力|Introducir el valor OLED|Ввести значение OLED|输入OLED数值',
  'channel|canal|canale|Kanal|チャンネル|canal|канал|通道',
  'value|valeur|valore|Wert|値|valor|значение|数值',
  'unknown|inconnue|sconosciuto|unbekannt|不明|desconocido|неизвестно|未知',
  'OLED screen:|Écran OLED :|Schermo OLED:|OLED-Anzeige:|OLED画面：|Pantalla OLED:|Экран OLED:|OLED屏幕：',
  'Inspect {name} from the OLED screen|Inspecter {name} depuis l’écran OLED|Ispeziona {name} dallo schermo OLED|{name} über die OLED-Anzeige prüfen|OLED画面から{name}を確認|Inspeccionar {name} desde la pantalla OLED|Открыть {name} с экрана OLED|从OLED屏幕查看{name}',
  'OLED value|Valeur OLED|Valore OLED|OLED-Wert|OLEDの値|Valor OLED|Значение OLED|OLED数值',
  'Arrows: adjust. Double-click: type a value. CC sent only when enabled.|Flèches : régler. Double-clic : saisir. Envoi CC seulement si activé.|Frecce: regola. Doppio clic: inserisci. CC inviati solo se attivato.|Pfeile: einstellen. Doppelklick: eingeben. CC-Senden nur bei Aktivierung.|矢印キー：調整。ダブルクリック：入力。CC送信は有効時のみ。|Flechas: ajustar. Doble clic: introducir. CC enviados solo si está activado.|Стрелки: настроить. Двойной щелчок: ввести. CC отправляются только при включении.|方向键：调节。双击：输入。仅启用时发送CC。',
  'MIDI sent|MIDI envoyé|MIDI inviato|MIDI gesendet|MIDI送信|MIDI enviado|Отправлено по MIDI|MIDI已发送',
  'local UI gesture|geste local IHM|gesto UI locale|lokale UI-Geste|ローカルUI操作|gesto local de interfaz|локальное действие в интерфейсе|本地界面操作',
  'Editor indicators, not a read-out of the hardware LEDs|Voyants de l’éditeur, pas une lecture des voyants matériels|Indicatori dell’editor, non una lettura dei LED hardware|Editor-Anzeigen, keine Auslesung der Hardware-LEDs|エディターのインジケーター。ハードウェアLEDの読み取りではありません|Indicadores del editor, no una lectura de los LED del hardware|Индикаторы редактора, а не показания аппаратных LED|编辑器指示灯，并非硬件LED的读数',
  'off|éteint|spento|aus|消灯|apagado|выкл.|熄灭',
  'activity|activité|attività|Aktivität|アクティビティ|actividad|активность|活动',
  'software indication|indication logicielle|indicazione software|Software-Anzeige|ソフトウェア表示|indicación por software|программная индикация|软件指示',
  'disabled, handling not implemented|désactivé, gestion non implémentée|disattivato, gestione non implementata|deaktiviert, Verarbeitung nicht implementiert|無効。処理は未実装|desactivado, gestión no implementada|отключено, обработка не реализована|已禁用，尚未实现处理',
  'Local configuration · hardware assignment writes are not validated.|Configuration locale · les écritures d’assignation matérielle ne sont pas validées.|Configurazione locale · le scritture di assegnazione hardware non sono convalidate.|Lokale Konfiguration · Schreiben von Hardware-Zuweisungen nicht validiert.|ローカル設定 · ハードウェア割り当ての書き込みは検証されていません。|Configuración local · las escrituras de asignación de hardware no están validadas.|Локальная конфигурация · запись аппаратных назначений не проверена.|本地配置 · 硬件分配写入未经验证。',
  'Controls & footswitches|Commandes et pédales|Controlli e pedali|Bedienelemente & Fußschalter|コントロールとフットスイッチ|Controles y pedales|Элементы управления и педали|控件与脚踏开关',
  'FOOTSW {count} function|Fonction FOOTSW {count}|Funzione FOOTSW {count}|FOOTSW {count}-Funktion|FOOTSW {count}の機能|Función FOOTSW {count}|Функция FOOTSW {count}|FOOTSW {count}功能',
  'CTRL · programmable|CTRL · programmable|CTRL · programmabile|CTRL · programmierbar|CTRL · プログラム可能|CTRL · programable|CTRL · программируемый|CTRL · 可编程',
  'LED brightness · hardware|Luminosité LED · matériel|Luminosità LED · hardware|LED-Helligkeit · Hardware|LED輝度 · ハードウェア|Brillo LED · hardware|Яркость LED · устройство|LED亮度 · 硬件',
  'Read-back:|Relecture :|Rilettura:|Rücklesen:|読み戻し：|Relectura:|Обратное чтение:|回读：',
  'LED brightness|Luminosité LED|Luminosità LED|LED-Helligkeit|LED輝度|Brillo LED|Яркость LED|LED亮度',
  'SysEx permission required · immediate effect only, no STORE.|Permission SysEx requise · effet immédiat seulement, pas de STORE.|Permesso SysEx richiesto · solo effetto immediato, nessun STORE.|SysEx-Berechtigung erforderlich · nur Sofortwirkung, kein STORE.|SysEx権限が必要 · 即時反映のみ、STOREなし。|Permiso SysEx requerido · solo efecto inmediato, sin STORE.|Требуется разрешение SysEx · только немедленный эффект, без STORE.|需要SysEx权限 · 仅即时生效，不执行STORE。',
  'Output routing|Routage de sortie|Instradamento uscita|Ausgangsrouting|出力ルーティング|Enrutamiento de salida|Маршрутизация выхода|输出路由',
  'Destination|Destination|Destinazione|Ziel|送信先|Destino|Назначение|目标',
  'Source|Source|Sorgente|Quelle|ソース|Origen|Источник|来源',
  'Filtered|Filtré|Filtrato|Gefiltert|フィルター済み|Filtrado|С фильтром|已过滤',
  'Full routing requires MIXED operation mode.|Le routage complet nécessite le mode de fonctionnement MIXED.|L’instradamento completo richiede la modalità operativa MIXED.|Vollständiges Routing erfordert den Betriebsmodus MIXED.|完全なルーティングには動作モードMIXEDが必要です。|El enrutamiento completo requiere el modo de funcionamiento MIXED.|Полная маршрутизация требует режима работы MIXED.|完整路由需要MIXED工作模式。',
  'General settings|Réglages généraux|Impostazioni generali|Allgemeine Einstellungen|一般設定|Ajustes generales|Общие настройки|常规设置',
  'Startup mode|Mode de démarrage|Modalità di avvio|Startmodus|起動モード|Modo de inicio|Режим запуска|启动模式',
  'Device ID|Device ID|ID dispositivo|Geräte-ID|デバイスID|ID de dispositivo|ID устройства|设备ID',
  'Operation mode|Mode de fonctionnement|Modalità operativa|Betriebsmodus|動作モード|Modo de funcionamiento|Режим работы|工作模式',
  'Control search|Recherche de contrôle|Ricerca controllo|Steuerelementsuche|コントロール検索|Búsqueda de control|Поиск элемента управления|控件搜索',
  'Search name, number, CC…|Rechercher nom, numéro, CC…|Cerca nome, numero, CC…|Name, Nummer, CC suchen…|名前、番号、CCを検索…|Buscar nombre, número, CC…|Поиск по имени, номеру, CC…|搜索名称、编号、CC…',
  'Control results|Résultats de contrôles|Risultati controlli|Steuerelement-Ergebnisse|コントロールの検索結果|Resultados de controles|Результаты поиска|控件结果',
  'No results|Aucun résultat|Nessun risultato|Keine Ergebnisse|該当なし|Sin resultados|Ничего не найдено|无结果',
]
const codes = ['en', 'fr', 'it', 'de', 'ja', 'es', 'ru', 'zh'] as const
export const catalog = Object.fromEntries([...rows, ...statusRows].map(row => { const parts = row.split('|'); return [parts[0], Object.fromEntries(codes.map((code, i) => [code, parts[i]]))] })) as Record<string, Record<Language, string>>
const patterns = Object.keys(catalog).filter(key => key.includes('{')).sort((a, b) => b.length - a.length).map(key => {
  const slots = [...key.matchAll(/\{(name|count|detail|file)\}/g)].map(m => m[1])
  const escaped = key.split(/\{(?:name|count|detail|file)\}/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return { key, slots, regex: new RegExp('^' + escaped.join('(.+?)') + '$') }
})
export function translate(text: string, language: Language): string {
  if (language === 'en') return text
  const trimmed = text.trim(), entry = catalog[trimmed]
  if (entry) return text.replace(trimmed, entry[language])
  for (const { key, slots, regex } of patterns) {
    const match = regex.exec(trimmed)
    if (!match) continue
    const result = catalog[key][language].replace(/\{(name|count|detail|file)\}/g, (_all, slot: string) => {
      const value = match[slots.indexOf(slot) + 1]
      return slot === 'detail' ? translate(value, language) : value
    })
    return text.replace(trimmed, result)
  }
  // Preserve values/identifiers in dynamic headings; no substring replacement in user labels.
  const prefix = /^(Encoder|Button|Push|Name|Parameter names ·|Import) (\d+|CC \d+|NRPN \d+|GS \d+)(.*)$/.exec(trimmed)
  return prefix ? `${catalog[prefix[1]]?.[language] || prefix[1]} ${prefix[2]}${prefix[3]}` : text
}
export function translatedTree(node: ReactNode, language: Language): ReactNode {
  if (language === 'en') return node // translate() is the identity in English: no need to clone the tree.
  if (typeof node === 'string') return translate(node, language)
  if (Array.isArray(node)) return node.map(n => translatedTree(n, language))
  if (!isValidElement(node) || typeof node.type !== 'string') return node
  const element = node as ReactElement<Record<string, unknown>>
  if (element.props['data-i18n-skip']) return node
  const props: Record<string, unknown> = {}
  for (const key of ['title', 'aria-label', 'placeholder']) if (typeof element.props[key] === 'string') props[key] = translate(element.props[key] as string, language)
  // Children go back positionally, not through Children.map (which re-keys them .0, .1… and would remount the
  // subtree on every en <-> other switch) nor through props.children (React would flag cloned keyless siblings).
  const children = element.props.children as ReactNode
  if (children === undefined) return cloneElement(element, props)
  return Array.isArray(children) ? cloneElement(element, props, ...children.map(child => translatedTree(child, language))) : cloneElement(element, props, translatedTree(children, language))
}
export function I18nProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState(loadLanguageChoice)
  const [detected, setDetected] = useState(browserLanguage)
  const language = choice === 'auto' ? detected : choice
  useEffect(() => { const update = () => setDetected(browserLanguage()); window.addEventListener('languagechange', update); return () => window.removeEventListener('languagechange', update) }, [])
  useEffect(() => { document.documentElement.lang = language }, [language])
  useEffect(() => { try { window.localStorage.setItem(languageKey, choice) } catch { /* Preference is optional. */ } }, [choice])
  return <Context.Provider value={{ language, choice, setChoice }}>{children}</Context.Provider>
}
export function LanguagePicker() {
  const { language, choice, setChoice } = useContext(Context)
  const title = `${translate('Language', language)} · ${choice === 'auto' ? translate('Automatic · browser', language) : languages.find(l => l.id === choice)?.name}`
  return <label className="language-icon-picker" title={title}><Icon name="language" /><select aria-label={translate('Language', language)} title={title} value={choice} onChange={e => setChoice(e.target.value === 'auto' ? 'auto' : parseLanguage(e.target.value))}><option value="auto">{translate('Automatic · browser', language)}</option>{languages.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
}
