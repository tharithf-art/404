/**
 * CollectionLocations.jsx — Locations table with CRUD, validation and
 * inline estimated-waste entry (changes trigger dynamic recalculation).
 */
import React, { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, X, Check, ChevronUp, ChevronDown, Flame } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PRIORITIES } from '../data/mockData';
import PriorityBadge from '../components/PriorityBadge';
import DisclaimerBadge from '../components/DisclaimerBadge';

const EMPTY_FORM = { name: '', area: '', lat: '', lng: '', waste_kg: '', priority: 'Medium', overflow: false, note: '' };

function validate(form) {
  const errors = {};
  if (!String(form.name).trim()) errors.name = 'Location name is required.';
  const lat = parseFloat(form.lat);
  const lng = parseFloat(form.lng);
  if (isNaN(lat) || lat < -90 || lat > 90) errors.lat = 'Valid latitude required (−90 to 90).';
  if (isNaN(lng) || lng < -180 || lng > 180) errors.lng = 'Valid longitude required (−180 to 180).';
  const waste = parseFloat(form.waste_kg);
  if (isNaN(waste) || waste < 0) errors.waste_kg = 'Waste must be zero or a positive number.';
  else if (waste > 100000) errors.waste_kg = 'Waste must be ≤ 100,000 kg.';
  if (!PRIORITIES.includes(form.priority)) errors.priority = 'Select a valid priority.';
  return errors;
}

function LocationModal({ mode, initial, onSave, onClose }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSave({ ...form, lat: parseFloat(form.lat), lng: parseFloat(form.lng), waste_kg: parseFloat(form.waste_kg) });
  };

  // Plain render helper (not a component) so inputs keep focus while typing
  const field = (label, name, type = 'text', placeholder = '') => (
    <div>
      <label className="label">{label}</label>
      <input id={`field-${name}`} type={type} step="any" value={form[name]} onChange={set(name)} placeholder={placeholder}
        className={`input ${errors[name] ? 'border-red-400 focus:ring-red-400' : ''}`} />
      {errors[name] && <p className="text-xs text-red-600 mt-1">{errors[name]}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">{mode === 'add' ? 'Add Collection Location' : 'Edit Collection Location'}</h2>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {field('Location name *', 'name', 'text', 'e.g. Flower Road Collection Point')}
          {field('Area / road', 'area', 'text', 'e.g. Flower Road')}
          <div className="grid grid-cols-2 gap-3">
            {field('Latitude *', 'lat', 'number', '6.9115')}
            {field('Longitude *', 'lng', 'number', '79.8655')}
          </div>
          {field('Estimated waste (kg) *', 'waste_kg', 'number', '250')}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Priority *</label>
              <select className="select" value={form.priority} onChange={set('priority')}>
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
              <input type="checkbox" checked={!!form.overflow} onChange={(e) => setForm((f) => ({ ...f, overflow: e.target.checked }))} />
              Bin is overflowing
            </label>
          </div>
          {field('Note (optional)', 'note', 'text', 'e.g. Simulated coordinate – Road Name')}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary"><Check size={15} /> {mode === 'add' ? 'Add Location' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function WasteInput({ loc, onCommit }) {
  const [val, setVal] = useState(String(loc.waste_kg));
  const [bad, setBad] = useState(false);
  React.useEffect(() => setVal(String(loc.waste_kg)), [loc.waste_kg]);
  const commit = () => {
    const n = parseFloat(val);
    if (isNaN(n) || n < 0 || n > 100000) { setBad(true); return; }
    setBad(false);
    if (n !== Number(loc.waste_kg)) onCommit(n);
  };
  return (
    <input type="number" min={0} value={val} onChange={(e) => setVal(e.target.value)} onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className={`input w-24 py-1 font-semibold ${bad ? 'border-red-400' : ''}`} title="Estimated waste (kg) — press Enter to apply" />
  );
}

export default function CollectionLocations() {
  const { locations, addLocation, updateLocation, deleteLocation, totalWaste, totalCapacity } = useApp();
  const [search, setSearch] = useState('');
  const [filterPriority, setFilter] = useState('All');
  const [modal, setModal] = useState(null);
  const [deleteConfirm, setDelConfirm] = useState(null);
  const [sortKey, setSortKey] = useState('id');
  const [sortAsc, setSortAsc] = useState(true);

  const toggleSort = (key) => { if (sortKey === key) setSortAsc((a) => !a); else { setSortKey(key); setSortAsc(true); } };

  const filtered = useMemo(() => {
    let arr = [...locations];
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter((l) => l.name.toLowerCase().includes(q) || (l.area || '').toLowerCase().includes(q) || l.id.toLowerCase().includes(q));
    }
    if (filterPriority === 'Overflow') arr = arr.filter((l) => l.overflow);
    else if (filterPriority !== 'All') arr = arr.filter((l) => l.priority === filterPriority);
    arr.sort((a, b) => {
      let va = a[sortKey] ?? ''; let vb = b[sortKey] ?? '';
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va === vb) return 0;
      return sortAsc ? (va < vb ? -1 : 1) : (va > vb ? -1 : 1);
    });
    return arr;
  }, [locations, search, filterPriority, sortKey, sortAsc]);

  const TH = ({ k, children }) => (
    <th className="table-header cursor-pointer select-none hover:bg-slate-100" onClick={() => toggleSort(k)}>
      <span className="flex items-center gap-1">{children}{sortKey === k && (sortAsc ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}</span>
    </th>
  );

  const pct = totalCapacity > 0 ? Math.round((totalWaste / totalCapacity) * 100) : 0;
  const barColor = pct > 100 ? 'bg-red-500' : pct > 90 ? 'bg-amber-500' : 'bg-green-600';

  return (
    <div className="p-5 lg:p-7 space-y-5">
      <DisclaimerBadge />
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search by ID, name or area…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select w-40" value={filterPriority} onChange={(e) => setFilter(e.target.value)}>
          <option value="All">All priorities</option>
          {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          <option value="Overflow">Overflowing only</option>
        </select>
        <button className="btn-primary" onClick={() => setModal({ mode: 'add', loc: null })}><Plus size={15} /> Add Location</button>
      </div>

      <div className="card py-3">
        <div className="flex items-center justify-between mb-1.5 text-xs text-slate-600">
          <span>Total waste vs available fleet capacity</span>
          <span className={`font-semibold ${pct > 100 ? 'text-red-600' : pct > 90 ? 'text-amber-600' : 'text-green-700'}`}>
            {totalWaste.toLocaleString()} kg / {totalCapacity.toLocaleString()} kg ({pct}%)
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <p className="text-[11px] text-slate-400 mt-1">Showing {filtered.length} of {locations.length} locations · edit waste directly in the table</p>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr>
                <TH k="id">ID</TH><TH k="name">Location</TH><TH k="lat">Lat</TH><TH k="lng">Lng</TH>
                <TH k="waste_kg">Est. waste (kg)</TH><TH k="priority">Priority</TH><th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="table-cell text-center text-slate-400 py-8">No locations match the current filters.</td></tr>
              )}
              {filtered.map((loc) => (
                <tr key={loc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="table-cell font-mono text-xs text-slate-500">{loc.id}</td>
                  <td className="table-cell font-medium text-slate-800">
                    {loc.name}
                    {loc.overflow && <span className="badge bg-red-100 text-red-700 ml-2"><Flame size={10} className="mr-0.5" />Overflow</span>}
                    {loc.note && <p className="text-[10px] text-slate-400 mt-0.5 italic">{loc.note}</p>}
                  </td>
                  <td className="table-cell font-mono text-xs">{Number(loc.lat).toFixed(4)}</td>
                  <td className="table-cell font-mono text-xs">{Number(loc.lng).toFixed(4)}</td>
                  <td className="table-cell"><WasteInput loc={loc} onCommit={(n) => updateLocation(loc.id, { waste_kg: n })} /></td>
                  <td className="table-cell"><PriorityBadge priority={loc.priority} /></td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <button className={`btn-icon ${loc.overflow ? 'text-red-500' : ''}`} title="Toggle overflowing"
                        onClick={() => updateLocation(loc.id, { overflow: !loc.overflow })}><Flame size={14} /></button>
                      <button className="btn-icon" title="Edit location" onClick={() => setModal({ mode: 'edit', loc })}><Pencil size={14} /></button>
                      <button className="btn-icon text-red-400 hover:text-red-600 hover:bg-red-50" title="Delete location"
                        onClick={() => setDelConfirm(loc.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <LocationModal mode={modal.mode} initial={modal.loc || {}}
          onSave={(data) => { if (modal.mode === 'add') addLocation(data); else updateLocation(modal.loc.id, data); setModal(null); }}
          onClose={() => setModal(null)} />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Delete location {deleteConfirm}?</h3>
            <p className="text-sm text-slate-600 mb-4">The location is removed from the scenario and routes are recalculated.</p>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setDelConfirm(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => { deleteLocation(deleteConfirm); setDelConfirm(null); }}><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
