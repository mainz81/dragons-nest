"use client";

import { useMemo, useState } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Card } from "@/components/Card";

type Task = {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function TasksPanel() {
  const { value: tasks, setValue: setTasks, loaded } = useLocalStorage<Task[]>(
    "dragons-nest:tasks:v1",
    []
  );
  const [text, setText] = useState("");

  const remaining = useMemo(() => tasks.filter((t) => !t.done).length, [tasks]);

  function addTask() {
    const t = text.trim();
    if (!t) return;
    setTasks([{ id: uid(), text: t, done: false, createdAt: Date.now() }, ...tasks]);
    setText("");
  }

  function toggle(id: string) {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  function remove(id: string) {
    setTasks(tasks.filter((t) => t.id !== id));
  }

  return (
    <Card className="lg:col-span-2">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted">Quick Tasks</h2>
        <span className="text-xs text-muted">
          {loaded ? `${remaining} remaining` : "Loading…"}
        </span>
      </div>

      <div className="mb-4 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addTask();
          }}
          placeholder="Add a task…"
          className="w-full rounded-xl border border-border bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/10"
        />
        <button
          onClick={addTask}
          className="rounded-xl border border-border bg-white/10 px-4 text-sm hover:bg-white/15"
        >
          Add
        </button>
      </div>

      <ul className="space-y-2">
        {tasks.length === 0 && (
          <li className="text-sm text-muted">No tasks yet. Add your first one above.</li>
        )}

        {tasks.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between rounded-xl border border-border bg-white/5 px-3 py-2"
          >
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => toggle(t.id)}
                className="h-4 w-4"
              />
              <span className={t.done ? "line-through opacity-60" : ""}>{t.text}</span>
            </label>
            <button
              onClick={() => remove(t.id)}
              className="text-xs text-muted hover:text-text"
              aria-label="Delete task"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
