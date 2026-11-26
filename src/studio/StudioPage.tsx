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
import { useEffect, useMemo, useState } from 'react';

import { CharacterStage } from '../character';
import { core, sentence, type KeeperProfile, type KeeperVoice, type ZoneLook } from '../kernel/ipc';
import { useEscape } from '../kernel/use-escape';
import { tryOn } from '../keepers/wardrobe-view';
import { useWardrobe } from '../keepers/useWardrobe';
import { WardrobeSection } from '../keepers/WardrobeSection';
import { DesignBox } from './DesignBox';
import { HabitsTab } from './HabitsTab';
import { LevelTab } from './LevelTab';
import { LookTab } from './LookTab';
import { MarketTab } from './MarketTab';
import { PersonalBox } from './PersonalBox';
import { useStudio } from './useStudio';
import { VoiceTab } from './VoiceTab';
import './studio.css';

type Tab = 'look' | 'outfit' | 'habits' | 'voice' | 'level' | 'market';
const TABS: { id: Tab; name: string }[] = [
  { id: 'look', name: 'Look' },
  { id: 'outfit', name: 'Outfit' },
  { id: 'habits', name: 'Habits' },
  { id: 'voice', name: 'Voice' },
  { id: 'level', name: 'Level' },
  { id: 'market', name: 'Marketplace' },
];

interface Props {
  open: boolean;
  keeper: KeeperProfile;
  /** The keeper's soul, by name (for sharing it as a pack). */
  soulName: string;
  onClose: () => void;
  /** Something was saved (keepers reload; the dashboard's stage redresses). */
  onSaved: () => void;
}

export function StudioPage({ open, keeper, soulName, onClose, onSaved }: Props) {
  const { info, error, reload } = useStudio(keeper.id, open);
  const [tab, setTab] = useState<Tab>('look');
  const [zone, setZone] = useState<string | null>(null);
  const [look, setLook] = useState<Record<string, ZoneLook>>(keeper.look ?? {});
  const [habits, setHabits] = useState<Record<string, number>>(keeper.habits ?? {});
  const [voice, setVoice] = useState<KeeperVoice | null>(keeper.voice ?? null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // The Outfit tab's try-on, shown on the big stage.
  const [wardrobeKey, setWardrobeKey] = useState(0);
  const market = useWardrobe(open && tab === 'market', () => {
    onSaved();
    reload();
  });
  const [outfit, setOutfit] = useState<{
    wearables: KeeperProfile['wearables'];
    caption: string;
  } | null>(null);

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

  useEscape(open, onClose);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await core.updateKeeper(keeper.id, voice ? { look, habits, voice } : { look, habits, appVoice: true });
      onSaved();
      reload();
    } catch (e) {
      setSaveError(sentence(e));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
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
          {saveError && <span className="error-line small">{saveError}</span>}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {dirty ? 'Cancel' : 'Close'}
          </button>
          <button type="button" className="btn btn-primary" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>
      <div className="studio-body">
        <section className="studio-stage" aria-label={`${keeper.name}, as you are making it`}>
          <CharacterStage
            className="studio-character"
            skin={keeper.skin}
            wearables={(tab === 'outfit' || tab === 'market') && outfit ? outfit.wearables : keeper.wearables}
            mood="idle"
            voiceLevel={0}
            mouth={0}
            memoryPulse={0}
          />
          {tab === 'look' && zone && info && <span className="studio-caption">{info.zones.find((z) => z.id === zone)?.name}</span>}
          {(tab === 'outfit' || tab === 'market') && outfit && <span className="studio-caption">{outfit.caption}</span>}
        </section>
        <section className="studio-panel">
          <div className="studio-tabs" role="tablist" aria-label="Studio">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`studio-tabbtn ${tab === t.id ? 'is-on' : ''}`} onClick={() => setTab(t.id)}>
                {t.name}
              </button>
            ))}
          </div>
          <div className="studio-scroll">
            {error && <p className="error-line">{error}</p>}
            {!info && !error && <p className="muted">Opening the Studio…</p>}
            {info && tab === 'look' && <LookTab info={info} look={look} zone={zone} onZone={setZone} onLook={setLook} />}
            {tab === 'outfit' && (
              <DesignBox
                wearables={keeper.wearables}
                onPreview={(w, caption) => setOutfit(w ? { wearables: w, caption } : null)}
                onKept={() => {
                  onSaved();
                  setWardrobeKey((k) => k + 1);
                }}
              />
            )}
            {info && tab === 'outfit' && <PersonalBox info={info} keeper={keeper.id} onChanged={() => onSaved()} />}
            {tab === 'outfit' && (
              <WardrobeSection
                key={wardrobeKey}
                open={open}
                keeper={keeper}
                onChanged={() => {
                  onSaved();
                  reload();
                }}
                studio={info ?? undefined}
                onPreview={(wearables, caption) => setOutfit({ wearables, caption })}
              />
            )}
            {info && tab === 'habits' && <HabitsTab info={info} name={keeper.name} habits={habits} onHabits={setHabits} />}
            {tab === 'voice' && <VoiceTab name={keeper.name} voice={voice} onVoice={setVoice} />}
            {info && tab === 'level' && <LevelTab info={info} name={keeper.name} />}
            {info && tab === 'market' && (
              <MarketTab
                info={info}
                keeper={keeper}
                wardrobe={market.wardrobe}
                busy={market.busy}
                soulName={soulName}
                onWear={(item) => void market.wear(keeper.id, item)}
                onTry={(id) => {
                  const item = market.wardrobe?.items.find((i) => i.id === id) ?? null;
                  setOutfit(
                    item && market.wardrobe
                      ? {
                          wearables: tryOn(keeper.wearables, item, market.wardrobe),
                          caption: `Trying on the ${item.name}`,
                        }
                      : null,
                  );
                }}
                onImported={() => {
                  onSaved();
                  setWardrobeKey((k) => k + 1);
                }}
              />
            )}
            {market.error && tab === 'market' && <p className="error-line">{market.error}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
