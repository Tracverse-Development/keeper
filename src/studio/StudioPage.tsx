/**
 * The Studio: a full page for making a keeper your own. The keeper stands large on the left
 * (choosing a body part zooms the stage onto it); tabs on the right: Look (colour and material
 * per part), Outfit (the wardrobe, rarity-framed and level-locked), Habits (what it does on its
 * own), Voice (test, then choose), Level (experience and unlocks).
 *
 * Look, habits and voice are a DRAFT, previewed live and kept only on Save (Cancel or Esc throws
 * it away). Outfit changes go through the wardrobe commands at once, as before. Opened from the
 * top bar, the keepers panel and the ⌘K palette. Design: docs/design/keeper-ecosystem.md.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { SKINS } from '../character';

import { CharacterStage, type PhotoRequest } from '../character';
import { core, sentence, type KeeperProfile, type KeeperVoice, type RoleInfo, type Soul, type ZoneLook } from '../kernel/ipc';
import { useEscape } from '../kernel/use-escape';
import { tryOn, tryOnSet } from '../keepers/wardrobe-view';
import { SoulSection } from '../keepers/SoulSection';
import { useWardrobe } from '../keepers/useWardrobe';
import { FeelingsTab } from './FeelingsTab';
import { wearDesigned } from './DesignBox';
import { ForgeTab } from './ForgeTab';
import { HabitsTab } from './HabitsTab';
import { InventoryTab } from './InventoryTab';
import { KeeperCard } from './KeeperCard';
import { cardOutfit, type CardFacts } from './keeper-card';
import { LevelTab } from './LevelTab';
import { LookTab } from './LookTab';
import { MarketTab } from './MarketTab';
import { ModesTab } from './ModesTab';
import { PhotoButton } from './PhotoButton';
import { saveWords } from './studio-view';
import { useStudio } from './useStudio';
import { VoiceTab } from './VoiceTab';
import '../keepers/wardrobe.css';
import './studio.css';

type Tab = 'look' | 'inventory' | 'forge' | 'soul' | 'feelings' | 'modes' | 'habits' | 'voice' | 'level' | 'market';
/** The tabs in three groups (how it looks, how it thinks, how it grows), each with one line saying what it is for. */
const GROUPS: { name: string; tabs: { id: Tab; name: string; about: string }[] }[] = [
  {
    name: 'Appearance',
    tabs: [
      { id: 'look', name: 'Look', about: 'A finish for the whole body, or colour and material one part at a time.' },
      { id: 'inventory', name: 'Inventory', about: 'Everything you own. Point at an item to try it on.' },
      { id: 'forge', name: 'Forge', about: 'Make your own items from a few words.' },
    ],
  },
  {
    name: 'Mind',
    tabs: [
      { id: 'soul', name: 'Soul', about: 'Who it is: its character and how it speaks.' },
      { id: 'feelings', name: 'Feelings', about: 'A simulated mood, with its reasons and an off switch.' },
      { id: 'modes', name: 'Modes', about: 'The jobs it can do, on one mind and memory. It switches mode when you ask for something another mode handles.' },
      { id: 'habits', name: 'Habits', about: 'What it does on its own when left alone.' },
      { id: 'voice', name: 'Voice', about: 'How it sounds. Test a voice, then choose it.' },
    ],
  },
  {
    name: 'Progress',
    tabs: [
      { id: 'level', name: 'Level', about: 'Experience earned by use, and what each level opens.' },
      { id: 'market', name: 'Marketplace', about: 'Items earned by level, and packs people share.' },
    ],
  },
];
const TABS = GROUPS.flatMap((g) => g.tabs);
/** Tabs that browse many items take the wide side; the keeper stands in a narrower stage. */
const BROWSE: Tab[] = ['inventory', 'market'];
/** A look, habit or voice change is saved this long after the last one. */
const AUTOSAVE_MS = 700;

interface Props {
  open: boolean;
  keeper: KeeperProfile;
  /** The keeper's soul, by name (for sharing it as a pack). */
  soulName: string;
  /** The souls to choose from (Keeper's and the person's own), and choosing one. */
  souls: Soul[];
  onSoul: (id: string) => void;
  onClose: () => void;
  /** Something was saved (keepers reload; the dashboard's stage redresses). */
  onSaved: () => void;
  /** The names of all the person's keepers (the Marketplace's Keepers side). */
  keeperNames: string[];
  /** The modes a keeper can work in (for tying a set to a mode: loadouts). */
  modes?: RoleInfo[];
}

export function StudioPage({ open, keeper, soulName, souls, onSoul, onClose, onSaved, keeperNames, modes = [] }: Props) {
  const { info, error, reload } = useStudio(keeper.id, open);
  const [tab, setTab] = useState<Tab>('look');
  const [zone, setZone] = useState<string | null>(null);
  const [look, setLook] = useState<Record<string, ZoneLook>>(keeper.look ?? {});
  const [habits, setHabits] = useState<Record<string, number>>(keeper.habits ?? {});
  const [voice, setVoice] = useState<KeeperVoice | null>(keeper.voice ?? null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // The Outfit tab's try-on, shown on the big stage.
  // Trying on a thinking or celebration effect plays that moment on the stage.
  const [celebrateN, setCelebrateN] = useState(0);
  // The back view: each press of Turn around turns the stage round (`CharacterStage.turnAround`).
  const [turnN, setTurnN] = useState(0);
  // Takes a photo of the keeper on the stage (photo mode: its card or a portrait).
  const photo = useRef<((request: PhotoRequest) => string | null) | null>(null);
  const still = (request: PhotoRequest) => photo.current?.(request) ?? null;
  // One wardrobe for the Inventory, the Forge and the Marketplace.
  const usesWardrobe = tab === 'inventory' || tab === 'forge' || tab === 'market';
  // The keeper card's outfit band reads it too (the Level tab, and the stage's Photo button on any tab).
  const market = useWardrobe(open, () => {
    onSaved();
    reload();
  });
  const [outfit, setOutfit] = useState<{ wearables: KeeperProfile['wearables']; caption: string; slot?: string | null; skin?: string } | null>(null);

  // A fresh draft whenever the Studio opens or the keeper changes.
  useEffect(() => {
    if (!open) return;
    setLook(keeper.look ?? {});
    setHabits(keeper.habits ?? {});
    setVoice(keeper.voice ?? null);
    setZone(null);
    setSaveError(null);
  }, [open, keeper.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(
    () => JSON.stringify(look) !== JSON.stringify(keeper.look ?? {}) || JSON.stringify(habits) !== JSON.stringify(keeper.habits ?? {}) || JSON.stringify(voice) !== JSON.stringify(keeper.voice ?? null),
    [look, habits, voice, keeper],
  );

  const moment = usesWardrobe && outfit?.slot && (outfit.slot === 'thinking' || outfit.slot === 'celebrate') ? outfit.slot : null;
  useEffect(() => {
    if (moment !== 'celebrate') return;
    setCelebrateN((n) => n + 1);
    const again = window.setInterval(() => setCelebrateN((n) => n + 1), 2600);
    return () => window.clearInterval(again);
  }, [moment, outfit?.caption]);

  useEscape(open, () => done());

  /** The draft as it would be saved (also what a failed save is remembered by). */
  const change = voice ? { look, habits, voice } : { look, habits, appVoice: true as const };
  const draftKey = JSON.stringify(change);
  // A draft whose save failed is not tried again by itself (only by Try again or a new change),
  // so a failing save never repeats every moment (review finding).
  const failedDraft = useRef('');

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await core.updateKeeper(keeper.id, change);
      // The core keeps colours in its own form (sorted, lower case, in range): the draft takes
      // what was kept, so it matches and is not saved again and again (review finding).
      const kept = saved.list.keepers.find((k) => k.id === keeper.id);
      if (kept) {
        setLook(kept.look ?? {});
        setHabits(kept.habits ?? {});
        setVoice(kept.voice ?? null);
      }
      failedDraft.current = '';
      onSaved();
      reload();
    } catch (e) {
      failedDraft.current = draftKey;
      setSaveError(sentence(e));
    } finally {
      setSaving(false);
    }
  };

  // Everything in the Studio is kept as it is changed: a look, a habit or a voice is saved a
  // moment after the last change, like an outfit or a soul already was. No Save button to forget.
  useEffect(() => {
    if (!open || !dirty || saving || failedDraft.current === draftKey) return;
    const timer = window.setTimeout(() => void save(), AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [open, dirty, saving, look, habits, voice]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Leaving keeps whatever was just changed, even mid-save: the latest draft is sent once more
   * (saving the same values twice changes nothing; review finding: a change made while a save
   * was running was lost). */
  const done = () => {
    if (dirty) void core.updateKeeper(keeper.id, change).then(onSaved).catch(() => undefined);
    onClose();
  };

  if (!open) return null;
  /** What the keeper card shows (the Level tab's card and the stage's Photo button). */
  const cardFacts = (studio: NonNullable<typeof info>): CardFacts => ({ name: keeper.name, level: studio.experience.level, soulName, species: SKINS.find((s) => s.id === keeper.skin)?.name ?? keeper.skin, outfit: market.wardrobe ? cardOutfit(keeper.wearables, market.wardrobe.items, market.wardrobe.sets ?? [], studio.rarities) : undefined });
  const level = info ? Math.max(1, info.experience.level) : null;
  return (
    <div className="studio" role="dialog" aria-modal="true" aria-label={`${keeper.name}'s Studio`}>
      <header className="studio-head">
        <div>
          <p className="eyebrow">Studio</p>
          <h1>
            {keeper.name}
            {level !== null && <span className="studio-badge">Level {level}</span>}
          </h1>
        </div>
        <div className="studio-actions">
          {saveError ? (
            <>
              <span className="error-line small">{saveError}</span>
              <button type="button" className="btn btn-small" onClick={() => { failedDraft.current = ''; void save(); }}>
                Try again
              </button>
            </>
          ) : (
            <span className="muted small" role="status">{saveWords(dirty, saving)}</span>
          )}
          <button type="button" className="btn btn-primary" onClick={done}>
            Done
          </button>
        </div>
      </header>
      <div className={`studio-body ${BROWSE.includes(tab) ? 'is-browse' : ''}`}>
        <nav className="studio-nav" role="tablist" aria-orientation="vertical" aria-label="Studio">
          {GROUPS.map((g) => (
            <div key={g.name} className="studio-navgroup" role="group" aria-label={g.name}>
              <span className="studio-navgroup-name">{g.name}</span>
              {g.tabs.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`studio-tabbtn ${tab === t.id ? 'is-on' : ''}`} onClick={() => setTab(t.id)}>
                  {t.name}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <section className="studio-stage" aria-label={`${keeper.name}, as you are making it`}>
          <CharacterStage
            className="studio-character"
            skin={(usesWardrobe && outfit?.skin) || keeper.skin}
            wearables={usesWardrobe && outfit ? outfit.wearables : keeper.wearables}
            look={usesWardrobe && outfit?.skin ? {} : look}
            habits={habits}
            focusZone={tab === 'look' ? zone : null}
            mood={moment === 'thinking' ? 'thinking' : 'idle'}
            emote={moment === 'celebrate' ? { name: 'celebrate', n: celebrateN } : undefined}
            voiceLevel={0}
            mouth={0}
            memoryPulse={0}
            photoRef={photo}
            turnable
            turnAround={turnN}
          />
          <button type="button" className="btn btn-small studio-turn" onClick={() => setTurnN((n) => n + 1)} title="Drag beside your keeper, or use the arrow keys on the stage, to turn it">
            Turn around
          </button>
          {info && <PhotoButton keeperId={keeper.id} facts={cardFacts(info)} still={still} />}
          {tab === 'look' && zone && info && <span className="studio-caption">{info.zones.find((z) => z.id === zone)?.name}</span>}
          {usesWardrobe && outfit && <span className="studio-caption">{outfit.caption}</span>}
        </section>
        <section className="studio-panel">
          <header className="studio-panel-head">
            <h2>{TABS.find((t) => t.id === tab)?.name}</h2>
            <p className="muted">{TABS.find((t) => t.id === tab)?.about}</p>
          </header>
          <div className="studio-scroll">
            {error && <p className="error-line">{error}</p>}
            {!info && !error && <p className="muted">Opening the Studio…</p>}
            {info && tab === 'look' && <LookTab info={info} look={look} zone={zone} onZone={setZone} onLook={setLook} />}
            {info && tab === 'inventory' && (
              <InventoryTab
                info={info}
                keeper={keeper}
                wardrobe={market.wardrobe}
                busy={market.busy}
                onWear={(item, colour) => void market.wear(keeper.id, item, colour)}
                onColour={(item, colour) => void market.colour(keeper.id, item, colour)}
                onTakeOff={(item) => void market.takeOff(keeper.id, item)}
                onGive={(item, to, mode) => void market.give(item, keeper.id, to, mode)}
                onTry={(item, colour) => setOutfit(item && market.wardrobe ? { wearables: tryOn(keeper.wearables, item, market.wardrobe, colour), caption: `Trying on the ${item.name}`, slot: item.slot } : null)}
              />
            )}
            {info && tab === 'forge' && (
              <ForgeTab
                info={info}
                keeper={keeper}
                busy={market.busy}
                onPreview={(w, caption) => setOutfit(w ? { wearables: w, caption } : null)}
                onForged={() => {
                  onSaved();
                  void market.reload();
                }}
                onMake={market.add}
              />
            )}
            {tab === 'soul' && <SoulSection value={keeper.soul} souls={souls} onPick={onSoul} onSaved={(saved) => { onSaved(); onSoul(saved.id); }} />}
            {tab === 'feelings' && (
              <FeelingsTab
                keeper={keeper}
                onToggle={(off) => {
                  void core.updateKeeper(keeper.id, { feelingsOff: off }).then(onSaved).catch((e) => setSaveError(sentence(e)));
                }}
              />
            )}
            {tab === 'modes' && <ModesTab onChanged={onSaved} />}
            {info && tab === 'habits' && <HabitsTab info={info} name={keeper.name} habits={habits} onHabits={setHabits} />}
            {tab === 'voice' && <VoiceTab name={keeper.name} voice={voice} onVoice={setVoice} />}
            {info && tab === 'level' && (
              <>
                <LevelTab info={info} name={keeper.name} />
                <KeeperCard keeperId={keeper.id} facts={cardFacts(info)} still={still} />
              </>
            )}
            {info && tab === 'market' && (
              <MarketTab
                info={info}
                keeper={keeper}
                wardrobe={market.wardrobe}
                busy={market.busy}
                soulName={soulName}
                onWear={(item, colour) => void market.wear(keeper.id, item, colour)}
                onColour={(item, colour) => void market.colour(keeper.id, item, colour)}
                onTry={(id, colour) => {
                  const item = market.wardrobe?.items.find((i) => i.id === id) ?? null;
                  setOutfit(
                    item && market.wardrobe
                      ? {
                          wearables: tryOn(keeper.wearables, item, market.wardrobe, colour),
                          caption: `Trying on the ${item.name}`,
                        }
                      : null,
                  );
                }}
                onImported={() => {
                  onSaved();
                  void market.reload();
                }}
                onSeasonTry={(item, name) => setOutfit(item ? { wearables: wearDesigned(keeper.wearables, { name, part: item.part, effects: item.effects ?? {} }), caption: `Trying on the ${name}` } : null)}
                onClaimed={() => void market.reload()}
                onWearSet={(set) => void market.wearSet(keeper.id, set)}
                onTrySet={(set) => {
                  const w = market.wardrobe;
                  const pieces = w && set ? w.items.filter((i) => i.set === set && (w.keepers.find((k) => k.id === keeper.id)?.wears ?? []).includes(i.id)) : [];
                  const name = w?.sets?.find((x) => x.id === set)?.name ?? '';
                  setOutfit(w && set && pieces.length ? { wearables: tryOnSet(keeper.wearables, pieces, w, set), caption: `Trying on ${name}` } : null);
                }}
                keeperNames={keeperNames}
                modes={modes}
                onLoadout={(mode, set) => core.setLoadout(keeper.id, mode, set).then(onSaved)}
                onTryStarter={(s) => {
                  const piece = s && market.wardrobe?.items.find((i) => i.id === `official:${s.piece}`);
                  setOutfit(s ? { wearables: [{ part: 'memory-halo' }, { part: 'ark-hull' }, ...(piece ? [{ part: piece.part, effects: piece.effects, item: piece.id, rarity: piece.rarity }] : [])], caption: `Meet ${s.name}`, skin: s.skin } : null);
                }}
                onStarterAdded={onSaved}
              />
            )}
            {market.error && usesWardrobe && <p className="error-line">{market.error}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
