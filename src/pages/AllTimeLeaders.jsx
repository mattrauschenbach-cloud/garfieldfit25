import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  addDoc,
  deleteDoc,
} from "firebase/firestore";

export default function AllTimeLeaders() {
  const [members, setMembers] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newName, setNewName] = useState("");

  // ---------- FETCH ----------
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setIsAdmin(user?.email === "mattrauschenbach@gmail.com");
      if (user) loadMembers();
    });
    return () => unsub();
  }, []);

  const loadMembers = async () => {
    const snapshot = await getDocs(collection(db, "members"));
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    const sorted = list
      .map((m) => ({
        ...m,
        firsts: m.firsts || 0,
        seconds: m.seconds || 0,
        thirds: m.thirds || 0,
        total: (m.firsts || 0) * 3 + (m.seconds || 0) * 2 + (m.thirds || 0),
      }))
      .sort((a, b) => b.total - a.total);
    setMembers(sorted);
  };

  // ---------- CRUD ----------
  const handleChange = (id, field, value) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, [field]: Number(value) || 0 } : m
      )
    );
  };

  const saveChanges = async (id, data) => {
    await updateDoc(doc(db, "members", id), {
      name: data.name,
      firsts: data.firsts || 0,
      seconds: data.seconds || 0,
      thirds: data.thirds || 0,
    });
    loadMembers();
  };

  const addMember = async () => {
    if (!newName.trim()) return;
    await addDoc(collection(db, "members"), {
      name: newName.trim(),
      firsts: 0,
      seconds: 0,
      thirds: 0,
    });
    setNewName("");
    loadMembers();
  };

  const deleteMember = async (id) => {
    if (!window.confirm("Delete this member?")) return;
    await deleteDoc(doc(db, "members", id));
    loadMembers();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6">
        🏁 All-Time Leaderboard
      </h1>

      {/* --- Add New Member --- */}
      {isAdmin && (
        <div className="flex items-center gap-2 mb-6">
          <input
            type="text"
            placeholder="Add new member name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 p-2 rounded-md border border-gray-700 bg-gray-800 text-gray-100"
          />
          <button
            onClick={addMember}
            className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-md"
          >
            Add
          </button>
        </div>
      )}

      {/* --- Table Header --- */}
      <div className="grid grid-cols-7 text-sm font-semibold text-gray-400 border-b border-gray-700 pb-2">
        <span>#</span>
        <span>Name</span>
        <span className="text-center">🥇</span>
        <span className="text-center">🥈</span>
        <span className="text-center">🥉</span>
        <span className="text-center">Points</span>
        {isAdmin && <span className="text-center">Actions</span>}
      </div>

      {/* --- Member Rows --- */}
      {members.map((m, i) => (
        <div
          key={m.id}
          className="grid grid-cols-7 items-center border-b border-gray-700 py-2 last:border-none text-gray-100"
        >
          <span className="text-gray-500 font-semibold">{i + 1}</span>
          <input
            disabled={!isAdmin}
            value={m.name}
            onChange={(e) => handleChange(m.id, "name", e.target.value)}
            className={`bg-transparent ${
              isAdmin ? "border border-gray-700 px-1 rounded" : "border-none"
            }`}
          />

          {isAdmin ? (
            <>
              <input
                type="number"
                value={m.firsts || 0}
                onChange={(e) => handleChange(m.id, "firsts", e.target.value)}
                className="w-14 mx-auto text-center bg-gray-800 border border-gray-600 rounded-md p-1"
              />
              <input
                type="number"
                value={m.seconds || 0}
                onChange={(e) => handleChange(m.id, "seconds", e.target.value)}
                className="w-14 mx-auto text-center bg-gray-800 border border-gray-600 rounded-md p-1"
              />
              <input
                type="number"
                value={m.thirds || 0}
                onChange={(e) => handleChange(m.id, "thirds", e.target.value)}
                className="w-14 mx-auto text-center bg-gray-800 border border-gray-600 rounded-md p-1"
              />
            </>
          ) : (
            <>
              <span className="text-center">{m.firsts}</span>
              <span className="text-center">{m.seconds}</span>
              <span className="text-center">{m.thirds}</span>
            </>
          )}

          <span className="text-center font-semibold text-yellow-400">
            {(m.firsts || 0) * 3 + (m.seconds || 0) * 2 + (m.thirds || 0)}
          </span>

          {isAdmin && (
            <div className="flex justify-center gap-1">
              <button
                onClick={() => saveChanges(m.id, m)}
                className="px-2 py-1 bg-blue-700 hover:bg-blue-600 text-xs rounded"
              >
                Save
              </button>
              <button
                onClick={() => deleteMember(m.id)}
                className="px-2 py-1 bg-red-700 hover:bg-red-600 text-xs rounded"
              >
                X
              </button>
            </div>
          )}
        </div>
      ))}

      <div className="text-center mt-6 text-sm text-gray-500">
        Points = 🥇×3 + 🥈×2 + 🥉×1 — Auto-ranked
      </div>
    </div>
  );
}
