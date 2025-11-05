import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  addDoc,
  deleteDoc,
  setDoc,
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

  // 🧠 Load all profiles (everyone), not just those with points
  const loadProfiles = async () => {
    const snapshot = await getDocs(collection(db, "profiles")); // ✅ your main user list
    const list = snapshot.docs.map((d) => ({
      id: d.id,
      name: d.data().name || "Unnamed",
      firsts: d.data().firsts || 0,
      seconds: d.data().seconds || 0,
      thirds: d.data().thirds || 0,
    }));

    // compute total points + sort by total
    const sorted = list
      .map((p) => ({
        ...p,
        total: (p.firsts || 0) * 3 + (p.seconds || 0) * 2 + (p.thirds || 0),
      }))
      .sort((a, b) => b.total - a.total);

    setProfiles(sorted);
  };

  // 🔧 Handle local edits
  const handleChange = (id, field, value) => {
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, [field]: field === "name" ? value : Number(value) || 0 } : p
      )
    );
  };

  // 💾 Save changes to Firestore
  const saveChanges = async (id, data) => {
    await updateDoc(doc(db, "profiles", id), {
      name: data.name,
      firsts: data.firsts || 0,
      seconds: data.seconds || 0,
      thirds: data.thirds || 0,
    });
    loadProfiles();
  };

  // ➕ Add new profile if not already in Firestore
  const addProfile = async () => {
    if (!newName.trim()) return;
    const ref = doc(collection(db, "profiles"));
    await setDoc(ref, {
      name: newName.trim(),
      firsts: 0,
      seconds: 0,
      thirds: 0,
    });
    setNewName("");
    loadProfiles();
  };

  // ❌ Delete a profile (optional)
  const deleteProfile = async (id) => {
    if (!window.confirm("Delete this profile?")) return;
    await deleteDoc(doc(db, "profiles", id));
    loadProfiles();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6">
        🏁 All-Time Leaderboard (All Members)
      </h1>

      {/* --- Add new profile --- */}
      {isAdmin && (
        <div className="flex items-center gap-2 mb-6">
          <input
            type="text"
            placeholder="Add new profile name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 p-2 rounded-md border border-gray-700 bg-gray-800 text-gray-100"
          />
          <button
            onClick={addProfile}
            className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-md"
          >
            Add
          </button>
        </div>
      )}

      {/* --- Header --- */}
      <div className="grid grid-cols-7 text-sm font-semibold text-gray-400 border-b border-gray-700 pb-2">
        <span>#</span>
        <span>Name</span>
        <span className="text-center">🥇</span>
        <span className="text-center">🥈</span>
        <span className="text-center">🥉</span>
        <span className="text-center">Points</span>
        {isAdmin && <span className="text-center">Actions</span>}
      </div>

      {/* --- Profiles --- */}
      {profiles.map((p, i) => (
        <div
          key={p.id}
          className="grid grid-cols-7 items-center border-b border-gray-700 py-2 last:border-none text-gray-100"
        >
          <span className="text-gray-500 font-semibold">{i + 1}</span>

          <input
            disabled={!isAdmin}
            value={p.name}
            onChange={(e) => handleChange(p.id, "name", e.target.value)}
            className={`bg-transparent ${
              isAdmin ? "border border-gray-700 px-1 rounded" : "border-none"
            }`}
          />

          {isAdmin ? (
            <>
              <input
                type="number"
                value={p.firsts}
                onChange={(e) => handleChange(p.id, "firsts", e.target.value)}
                className="w-14 mx-auto text-center bg-gray-800 border border-gray-600 rounded-md p-1"
              />
              <input
                type="number"
                value={p.seconds}
                onChange={(e) => handleChange(p.id, "seconds", e.target.value)}
                className="w-14 mx-auto text-center bg-gray-800 border border-gray-600 rounded-md p-1"
              />
              <input
                type="number"
                value={p.thirds}
                onChange={(e) => handleChange(p.id, "thirds", e.target.value)}
                className="w-14 mx-auto text-center bg-gray-800 border border-gray-600 rounded-md p-1"
              />
            </>
          ) : (
            <>
              <span className="text-center">{p.firsts}</span>
              <span className="text-center">{p.seconds}</span>
              <span className="text-center">{p.thirds}</span>
            </>
          )}

          <span className="text-center font-semibold text-yellow-400">
            {p.total}
          </span>

          {isAdmin && (
            <div className="flex justify-center gap-1">
              <button
                onClick={() => saveChanges(p.id, p)}
                className="px-2 py-1 bg-blue-700 hover:bg-blue-600 text-xs rounded"
              >
                Save
              </button>
              <button
                onClick={() => deleteProfile(p.id)}
                className="px-2 py-1 bg-red-700 hover:bg-red-600 text-xs rounded"
              >
                X
              </button>
            </div>
          )}
        </div>
      ))}

      <div className="text-center mt-6 text-sm text-gray-500">
        Points = 🥇×3 + 🥈×2 + 🥉×1 — Auto-ranked even if no points
      </div>
    </div>
  );
}
