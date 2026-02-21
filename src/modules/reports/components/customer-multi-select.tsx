"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronsUpDown } from "lucide-react";

interface Customer {
  id: string;
  name: string;
}

interface CustomerMultiSelectProps {
  customers: Customer[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function CustomerMultiSelect({ customers, selected, onChange }: CustomerMultiSelectProps) {
  const [open, setOpen] = useState(false);

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  function selectAll() {
    onChange(customers.map(c => c.id));
  }

  function deselectAll() {
    onChange([]);
  }

  const label = selected.length === 0
    ? "Alla fastpriskunder"
    : `${selected.length} kund${selected.length === 1 ? "" : "er"} valda`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-64 justify-between">
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Sök kund..." />
          <div className="flex items-center gap-2 px-3 py-2 border-b">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAll}>
              Markera alla
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={deselectAll}>
              Avmarkera alla
            </Button>
          </div>
          <CommandList>
            <CommandEmpty>Inga kunder hittades.</CommandEmpty>
            <CommandGroup>
              {customers.map(c => (
                <CommandItem key={c.id} value={c.name} onSelect={() => toggle(c.id)}>
                  <Checkbox
                    checked={selected.includes(c.id)}
                    className="mr-2"
                  />
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
