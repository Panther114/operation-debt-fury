import { ASSETS } from './assets';
import type { Effect } from './upgrades';

export interface ResearchDef {
  id: string;
  branch: string;
  name: string;
  desc: string;
  cost: number;
  requires: string[];
  effects: Effect[];
}

export const RESEARCH_BRANCHES = [
  { id: 'st', name: 'Stealth', color: '#7d7392' },
  { id: 'hy', name: 'Hypersonics', color: '#f08a24' },
  { id: 'au', name: 'Autonomy', color: '#6fd3f0' },
  { id: 'nu', name: 'Nuclear', color: '#9be564' },
  { id: 'sp', name: 'Space', color: '#8a5cc8' },
];

type Node = [name: string, desc: string, effects: Effect[]];

const TREE: Record<string, { anchors: number[]; nodes: Node[] }> = {
  st: { anchors: [7, 11, 15, 19, 23, 27, 31, 35], nodes: [
    ['Radar Absorbent Paint', 'All air assets ×1.25. The paint costs more than the plane it is on.', [{ type: 'domainMult', domain: 'air', mult: 1.25 }]],
    ['Low-Observable Canopies', 'Fighters ×1.5.', [{ type: 'tagMult', tag: 'fighter', mult: 1.5 }]],
    ['Unmarked Envelopes', 'Lobbyist briefcases appear 20% more often. Harder for auditors to track.', [{ type: 'eventFreq', mult: 1.2 }]],
    ['Planform Alignment', 'Stealth assets ×2.', [{ type: 'tagMult', tag: 'stealth', mult: 2 }]],
    ['Deep Penetration Doctrine', 'Bombers ×2.', [{ type: 'tagMult', tag: 'bomber', mult: 2 }]],
    ['Sixth-Generation Concepts', 'Unlocks the F-47 NGAD Fighter. Stealth assets ×1.5.', [{ type: 'unlock' }, { type: 'tagMult', tag: 'stealth', mult: 1.5 }]],
    ['Metamaterial Skins', 'All air assets ×2.', [{ type: 'domainMult', domain: 'air', mult: 2 }]],
    ['Invisible Budget Line', 'Everything ×1.5. The money is still there; you just cannot see it.', [{ type: 'globalMult', mult: 1.5 }]],
  ] },
  hy: { anchors: [6, 10, 14, 18, 22, 26, 30, 34], nodes: [
    ['Mach 5 Wallet', 'Click power ×2.', [{ type: 'clickMult', mult: 2 }]],
    ['Scramjet Prototypes', 'Missile assets ×1.5.', [{ type: 'tagMult', tag: 'missile', mult: 1.5 }]],
    ['Boost-Glide Spending', 'Clicks spend an additional 2% of $/s.', [{ type: 'clickRate', pct: 2 }]],
    ['Thermal Protection Tiles', 'Missile assets ×2.', [{ type: 'tagMult', tag: 'missile', mult: 2 }]],
    ['Prompt Global Strike', 'Click power ×3.', [{ type: 'clickMult', mult: 3 }]],
    ['Waverider Economics', 'Clicks spend an additional 3% of $/s.', [{ type: 'clickRate', pct: 3 }]],
    ['Hypersonic Long-Range Fires', 'Missile and artillery assets ×3.', [{ type: 'tagMult', tag: 'missile', mult: 3 }]],
    ['Faster-Than-Audit Travel', 'Everything ×1.5.', [{ type: 'globalMult', mult: 1.5 }]],
  ] },
  au: { anchors: [5, 9, 13, 17, 21, 25, 29, 33], nodes: [
    ['Loyal Wingman Drones', 'Drones ×3.', [{ type: 'tagMult', tag: 'drone', mult: 3 }]],
    ['Intern Swarm', 'Unpaid interns click the pallet 2 times per second.', [{ type: 'autoClick', perSec: 2 }]],
    ['Predictive Maintenance AI', 'Everything ×1.1. It predicts that maintenance will be expensive.', [{ type: 'globalMult', mult: 1.1 }]],
    ['Robotic Process Automation', 'Interns click 5 more times per second.', [{ type: 'autoClick', perSec: 5 }]],
    ['Autonomous Lobbying Agents', 'Event effects last 25% longer.', [{ type: 'eventDur', mult: 1.25 }]],
    ['Collaborative Combat Aircraft', 'Support aircraft ×3.', [{ type: 'tagMult', tag: 'support', mult: 3 }]],
    ['Procurement Singularity', 'Interns replaced by an AI that clicks 10 more times per second.', [{ type: 'autoClick', perSec: 10 }]],
    ['Self-Writing Budget Requests', 'Everything ×1.5.', [{ type: 'globalMult', mult: 1.5 }]],
  ] },
  nu: { anchors: [8, 12, 16, 20, 24, 28, 32, 36], nodes: [
    ['Enriched Spending', 'Nuclear assets ×1.5.', [{ type: 'tagMult', tag: 'nuclear', mult: 1.5 }]],
    ['Naval Reactors Program', 'All sea assets ×1.25.', [{ type: 'domainMult', domain: 'sea', mult: 1.25 }]],
    ['Quieter Propulsors', 'Submarines ×2.', [{ type: 'tagMult', tag: 'sub', mult: 2 }]],
    ['Life-of-Ship Cores', 'Carriers ×2.', [{ type: 'tagMult', tag: 'carrier', mult: 2 }]],
    ['Strike Group Integration', 'Unlocks the Carrier Strike Group. All sea assets ×1.25.', [{ type: 'unlock' }, { type: 'domainMult', domain: 'sea', mult: 1.25 }]],
    ['Triad Recapitalization', 'Nuclear assets ×2.', [{ type: 'tagMult', tag: 'nuclear', mult: 2 }]],
    ['Fusion Procurement', 'All sea assets ×2.', [{ type: 'domainMult', domain: 'sea', mult: 2 }]],
    ['Critical Mass Budget', 'Everything ×1.5.', [{ type: 'globalMult', mult: 1.5 }]],
  ] },
  sp: { anchors: [20, 24, 28, 30, 32, 34, 36, 38], nodes: [
    ['GPS Premium Tier', 'Everything ×1.05. Now with ads.', [{ type: 'globalMult', mult: 1.05 }]],
    ['Space Domain Awareness', 'Events appear 15% more often.', [{ type: 'eventFreq', mult: 1.15 }]],
    ['Orbital Interceptors', 'Unlocks the Orbital Missile Shield.', [{ type: 'unlock' }]],
    ['Zero-G Logistics', 'Space assets ×2.', [{ type: 'domainMult', domain: 'space', mult: 2 }]],
    ['Orbital Shipyards', 'Unlocks the Space Force Orbital Carrier.', [{ type: 'unlock' }]],
    ['Space Force Song', 'Everything ×1.25. Nobody has heard it. That is not the point.', [{ type: 'globalMult', mult: 1.25 }]],
    ['Lunar Lift Contract', 'Unlocks the Lunar Marine Base.', [{ type: 'unlock' }]],
    ['Stellar Engineering', 'Unlocks the Dyson Sphere Defense Contract. Space assets ×3.', [{ type: 'unlock' }, { type: 'domainMult', domain: 'space', mult: 3 }]],
  ] },
};

export const RESEARCH: ResearchDef[] = Object.entries(TREE).flatMap(([branch, { anchors, nodes }]) =>
  nodes.map(([name, desc, effects], i) => ({
    id: `${branch}${i + 1}`,
    branch, name, desc, effects,
    cost: ASSETS[anchors[i]].baseCost * 25,
    requires: i ? [`${branch}${i}`] : [],
  })),
);

export const RESEARCH_BY_ID: Record<string, ResearchDef> = Object.fromEntries(RESEARCH.map(r => [r.id, r]));
