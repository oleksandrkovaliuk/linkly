import { Search } from "lucide-react";

import { Input } from "./ui/input";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  return (
    <div className="relative w-full">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? "Search links"}
        className="h-9 pl-8"
      />
    </div>
  );
}
