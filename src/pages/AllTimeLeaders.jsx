import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
} from "firebase/firestore";

export default function AllTimeLeaders() {
  const [profiles, setProfiles] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setIsAdmin(user?.email === "mattrauschenbach@gmail.com");
      if (user) loadProfiles();
    });
    return () => unsub();
  }, []);

  // ---------- load everything ----------
  const loadProfiles = async () => {
    const snap = await getDocs(collection(db, "profiles"));
    const list = snap.docs.map((d) => ({
      id: d.id,
      name: d.data().name || "Unnamed",
      firsts: d.data().firsts || 0,
      seconds: d.data().seconds || 0,
      thirds: d.data().thirds || 0,
    }));
    const ranked = list
      .map((p) => ({
        ...p,
        total: p.firsts * 3 + p.seconds * 2 + p.thirds,
      }))
      .sort((a, b) => b.total - a.total);
    setProfiles(ranked);
  };

  const handleChange = (id, field, val) => {
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, [field]: field === "name" ? val : +val || 0 } : p
      )
    );
  };

  const save = async (p) => {
    await updateDoc(doc(db, "profiles", p.id), {
      name: p.name,
      firsts: p.firsts,
      seconds: p.seconds,
      thirds: p.thirds,
    });
    loadProfiles();
  };

  const addProfile = async () => {
    if (!newName.trim()) return;
    await addDoc(collection(db, "profiles"), {
      name: newName.trim(),
      firsts: 0,
      seconds: 0,
      thirds: 0,
    });
    setNewName("");
    loadProfiles();
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this profile?")) return;
    await deleteDoc(doc(db, "profiles", id));
    loadProfiles();
  };

  // ---------- ui ----------
  const rankColor = (i) =>
    i === 0
      ? "text-yellow-400 drop-shadow-[0_0_6px_gold]"
      : i === 1
      ? "text-gray-300"
      : i === 2
      ? "text-amber-600"
      : "text-gray-400";

  return (
    <div className="p-6 max-w-5xl mx-auto text-gray-100">
      {/* header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold text-white mb-2 drop-shadow">
          🏆 Fire Fit All-Time Leaders
        </h1>
        <p className="text-gray-400">
          Points = 🥇×3 + 🥈×2 + 🥉×1 — updated live
        </p>
      </div>

      {/* add new */}
      {isAdmin && (
        <div className="flex items-center gap-2 mb-6">
          <input
            type="text"
            placeholder="Add firefighter..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 p-2 rounded-md border border-gray-700 bg-gray-900 text-gray-100"
          />
          <button
            onClick={addProfile}
            className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-md font-semibold"
          >
            Add
          </button>
        </div>
      )}

      {/* table */}
      <div className="overflow-hidden rounded-xl border border-gray-700 shadow-lg">
        <div className="grid grid-cols-7 bg-[#111827] px-3 py-2 font-semibold text-gray-400 text-sm">
          <span>#</span>
          <span>Name</span>
          <span className="text-center">🥇</span>
          <span className="text-center">🥈</span>
          <span className="text-center">🥉</span>
          <span className="text-center">Points</span>
          {isAdmin && <span className="text-center">Actions</span>}
        </div>

        {profiles.map((p, i) => (
          <div
            key={p.id}
            className={`grid grid-cols-7 items-center px-3 py-2 border-t border-gray-800 ${
              i % 2 === 0 ? "bg-[#1f2937]" : "bg-[#111827]"
            }`}
          >
            <span className={`font-bold ${rankColor(i)}`}>{i + 1}</span>

            <input
              disabled={!isAdmin}
              value={p.name}
              onChange={(e) => handleChange(p.id, "name", e.target.value)}
              className={`bg-transparent ${
                isAdmin
                  ? "border border-gray-700 rounded px-1"
                  : "border-none outline-none"
              }`}
            />

            {["firsts", "seconds", "thirds"].map((field) =>
              isAdmin ? (
                <input
                  key={field}
                  type="number"
                  value={p[field]}
                  onChange={(e) => handleChange(p.id, field, e.target.value)}
                  className="w-14 mx-auto text-center bg-gray-900 border border-gray-700 rounded-md p-1"
                />
              ) : (
                <span key={field} className="text-center">
                  {p[field]}
                </span>
              )
            )}

            <span className="text-center font-semibold text-yellow-400">
              {p.total}
            </span>

            {isAdmin && (
              <div className="flex justify-center gap-1">
                <button
                  onClick={() => save(p)}
                  className="px-2 py-1 bg-blue-700 hover:bg-blue-600 text-xs rounded"
                >
                  Save
                </button>
                <button
                  onClick={() => remove(p.id)}
                  className="px-2 py-1 bg-red-700 hover:bg-red-600 text-xs rounded"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
