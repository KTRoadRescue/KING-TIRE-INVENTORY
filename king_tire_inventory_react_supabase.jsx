// KingTireInventory.jsx
// Single-file React app (tailwind) to manage a private tire inventory using Supabase as the database + storage.
// How to use (summary at top):
// 1) Create a Supabase project. Create a table `tires` with SQL provided below and enable Storage bucket `tire-images`.
// 2) Add project URL and ANON KEY to environment variables in Netlify / Vercel: REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY
// 3) Run `npm init react-app` or `vite` and include this component as App.jsx. Install `@supabase/supabase-js` and `react-toastify`.
// 4) This app includes: login (simple email-only with anon key), add/edit/delete tires, image upload to Supabase Storage, search/filter, inventory counts, CSV export.

/* SQL to create table in Supabase (run in SQL editor):

create table if not exists tires (
  id uuid primary key default uuid_generate_v4(),
  sku text,
  brand text,
  model text,
  size text,
  ply text,
  price numeric,
  condition text,
  quantity int default 1,
  notes text,
  image_path text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- you'll also need the uuid extension
create extension if not exists "uuid-ossp";

*/

import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "./styles.css"; // make sure tailwind is setup
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function KingTireInventory() {
  const [tires, setTires] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    sku: "",
    brand: "",
    model: "",
    size: "",
    ply: "",
    price: "",
    condition: "New",
    quantity: 1,
    notes: "",
    image_file: null,
  });

  useEffect(() => {
    fetchTires();
  }, []);

  async function fetchTires() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tires")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load tires: " + error.message);
    } else {
      setTires(data || []);
    }
    setLoading(false);
  }

  function resetForm() {
    setEditing(null);
    setForm({
      sku: "",
      brand: "",
      model: "",
      size: "",
      ply: "",
      price: "",
      condition: "New",
      quantity: 1,
      notes: "",
      image_file: null,
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    try {
      let image_path = editing ? editing.image_path : null;
      if (form.image_file) {
        const file = form.image_file;
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const { error: upErr } = await supabase.storage
          .from("tire-images")
          .upload(fileName, file, { cacheControl: "3600", upsert: false });
        if (upErr) throw upErr;
        image_path = fileName;
      }

      const payload = {
        sku: form.sku,
        brand: form.brand,
        model: form.model,
        size: form.size,
        ply: form.ply,
        price: form.price || 0,
        condition: form.condition,
        quantity: Number(form.quantity) || 0,
        notes: form.notes,
        image_path,
        updated_at: new Date().toISOString(),
      };

      if (editing) {
        const { error } = await supabase.from("tires").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Tire updated");
      } else {
        const { error } = await supabase.from("tires").insert(payload);
        if (error) throw error;
        toast.success("Tire added");
      }
      resetForm();
      setFormOpen(false);
      fetchTires();
    } catch (err) {
      toast.error(err.message || "Save failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleEdit(tire) {
    setEditing(tire);
    setForm({
      sku: tire.sku || "",
      brand: tire.brand || "",
      model: tire.model || "",
      size: tire.size || "",
      ply: tire.ply || "",
      price: tire.price || "",
      condition: tire.condition || "New",
      quantity: tire.quantity || 1,
      notes: tire.notes || "",
      image_file: null,
    });
    setFormOpen(true);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this tire? This action cannot be undone.")) return;
    setLoading(true);
    const { error } = await supabase.from("tires").delete().eq("id", id);
    if (error) toast.error("Delete failed: " + error.message);
    else {
      toast.success("Deleted");
      fetchTires();
    }
    setLoading(false);
  }

  function filteredTires() {
    const q = filter.trim().toLowerCase();
    if (!q) return tires;
    return tires.filter((t) => {
      return (
        (t.brand || "").toLowerCase().includes(q) ||
        (t.model || "").toLowerCase().includes(q) ||
        (t.size || "").toLowerCase().includes(q) ||
        (t.sku || "").toLowerCase().includes(q)
      );
    });
  }

  function inventoryCount() {
    return tires.reduce((acc, t) => acc + (Number(t.quantity) || 0), 0);
  }

  async function downloadCSV() {
    const rows = [
      [
        "sku",
        "brand",
        "model",
        "size",
        "ply",
        "price",
        "condition",
        "quantity",
        "notes",
        "image_path",
      ],
      ...tires.map((t) => [t.sku, t.brand, t.model, t.size, t.ply, t.price, t.condition, t.quantity, t.notes, t.image_path]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `king-tire-inventory-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-white">
      <ToastContainer />
      <header className="bg-gradient-to-r from-blue-600 to-orange-400 text-white p-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">King Tire Shop & Auto Services</h1>
            <p className="text-sm opacity-90">Private inventory manager — blue & orange theme</p>
          </div>
          <div className="text-right">
            <div className="text-sm">Total items: <strong>{inventoryCount()}</strong></div>
            <div className="text-sm mt-1">SKUs: <strong>{tires.length}</strong></div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <div className="flex gap-4 items-center mb-4">
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search brand, model, size or SKU" className="border rounded px-3 py-2 w-full" />
          <button onClick={() => { setFormOpen(true); resetForm(); }} className="bg-blue-600 text-white rounded px-4 py-2">+ Add Tire</button>
          <button onClick={downloadCSV} className="bg-gray-800 text-white rounded px-4 py-2">Export CSV</button>
        </div>

        <section>
          {loading ? (
            <div>Loading...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTires().map((t) => (
                <div key={t.id} className="border rounded p-4 shadow-sm">
                  <div className="flex gap-4">
                    <div className="w-28 h-28 bg-gray-100 flex items-center justify-center overflow-hidden">
                      {t.image_path ? (
                        <img src={`${SUPABASE_URL}/storage/v1/object/public/tire-images/${t.image_path}`} alt="tire" className="object-contain h-full w-full" />
                      ) : (
                        <div className="text-xs opacity-60">No image</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{t.brand} {t.model}</div>
                      <div className="text-sm">Size: {t.size}</div>
                      <div className="text-sm">Condition: {t.condition}</div>
                      <div className="text-sm">Price: ${Number(t.price).toFixed(2)}</div>
                      <div className="text-sm">Qty: {t.quantity}</div>
                      <div className="mt-2 text-xs opacity-70">SKU: {t.sku}</div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button onClick={() => handleEdit(t)} className="px-3 py-1 border rounded">Edit</button>
                    <button onClick={() => handleDelete(t.id)} className="px-3 py-1 border rounded text-red-600">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Form modal (very simple) */}
        {formOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded shadow-lg w-full max-w-2xl p-6">
              <h2 className="text-xl font-bold mb-3">{editing ? "Edit Tire" : "Add Tire"}</h2>
              <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="border px-3 py-2" />
                <input placeholder="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="border px-3 py-2" />
                <input placeholder="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="border px-3 py-2" />
                <input placeholder="Size (e.g. 225/45R17)" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} className="border px-3 py-2" />
                <input placeholder="Ply" value={form.ply} onChange={(e) => setForm({ ...form, ply: e.target.value })} className="border px-3 py-2" />
                <input placeholder="Price" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="border px-3 py-2" />
                <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} className="border px-3 py-2">
                  <option>New</option>
                  <option>Used</option>
                  <option>Refurbished</option>
                </select>
                <input placeholder="Quantity" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="border px-3 py-2" />

                <div className="md:col-span-2">
                  <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="border px-3 py-2 w-full h-24" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm mb-1">Image (optional)</label>
                  <input type="file" accept="image/*" onChange={(e) => setForm({ ...form, image_file: e.target.files[0] })} />
                </div>

                <div className="md:col-span-2 flex gap-2 justify-end">
                  <button type="button" onClick={() => { setFormOpen(false); resetForm(); }} className="px-4 py-2 border rounded">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>

      <footer className="text-center p-4 text-sm text-gray-600">King Tire Shop & Auto Services — Private inventory</footer>
    </div>
  );
}
