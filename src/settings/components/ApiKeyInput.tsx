import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SettingRow } from "./SettingRow";

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string | null) => void;
  label?: string;
}

export function ApiKeyInput({ value, onChange, label = "API Key" }: ApiKeyInputProps): React.ReactNode {
  const [show, setShow] = useState(false);

  return (
    <SettingRow label={label}>
      <div className="flex items-center gap-2">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder="Enter API key"
          className="flex-1 text-[13px]"
        />
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShow(!show)}
        >
          {show ? "Hide" : "Show"}
        </Button>
      </div>
    </SettingRow>
  );
}
