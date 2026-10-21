import { Plus, X } from "lucide-react";
import type { User } from "../../types";
import { Avatar, Dropdown, MenuItem } from "./basics";

interface Props {
  users: User[];
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  placeholder?: string;
}

export function UserChipSelect({ users, value, onChange, label = "Responsáveis", placeholder = "Todos os responsáveis" }: Props) {
  const chosen = users.filter((u) => value.includes(u.id));
  const rest = users.filter((u) => !value.includes(u.id));
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label={label} role="group">
      {chosen.length === 0 && <span className="muted text-sm">{placeholder}</span>}
      {chosen.map((u) => (
        <span key={u.id} className="chip border border-line bg-white py-0.5 pl-0.5 pr-1 dark:border-white/10 dark:bg-[#0F1115]">
          <Avatar user={u} size={20} />
          <span className="max-w-[120px] truncate">{u.name.split(" ")[0]}</span>
          <button className="rounded-full p-0.5 hover:bg-gray-200 dark:hover:bg-white/10" onClick={() => onChange(value.filter((id) => id !== u.id))} aria-label={`Remover ${u.name}`}>
            <X size={12} />
          </button>
        </span>
      ))}
      {rest.length > 0 && (
        <Dropdown label={`Adicionar ${label.toLowerCase()}`} align="left" trigger={() => <button type="button" className="btn-icon h-7 w-7 rounded-full border border-dashed border-gray-300 dark:border-white/20" aria-label={`Adicionar ${label.toLowerCase()}`}><Plus size={14} /></button>}>
          {(close) =>
            rest.map((u) => (
              <MenuItem key={u.id} onClick={() => { onChange([...value, u.id]); close(); }}>
                <Avatar user={u} size={22} /> {u.name}
              </MenuItem>
            ))
          }
        </Dropdown>
      )}
    </div>
  );
}
