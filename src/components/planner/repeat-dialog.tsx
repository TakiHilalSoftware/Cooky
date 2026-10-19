"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { weekDays, addDays } from "@/lib/dates";
import { repeatPlannedMeal } from "@/server/actions/planner";
import type { PlannedMealDto } from "@/server/features/planner/dto";

import { usePlannerWrite } from "./use-planner-actions";

const asDate = (day: string) => new Date(`${day}T12:00:00Z`);

/** "Repeat a meal" (PRD §3.5): the same dish and slot on other days of this week or the next. */
export function RepeatDialog({
  meal,
  weekStart,
  onClose,
}: {
  meal: PlannedMealDto | null;
  weekStart: string;
  onClose: () => void;
}) {
  const t = useTranslations("planner");
  const format = useFormatter();
  const write = usePlannerWrite();
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const weeks = [weekDays(weekStart), weekDays(addDays(weekStart, 7))];

  async function save() {
    if (!meal || picked.length === 0) return;
    setSaving(true);
    const result = await write(() => repeatPlannedMeal({ id: meal.id, dates: picked }));
    setSaving(false);
    if (result) {
      toast.success(t("repeated", { count: result.added, name: meal.name }));
      setPicked([]);
      onClose();
    }
  }

  return (
    <Dialog
      open={meal !== null}
      onOpenChange={(open) => {
        if (!open) {
          setPicked([]);
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("repeatTitle", { name: meal?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t("repeatBody")}</DialogDescription>
        </DialogHeader>
        {weeks.map((days, w) => (
          <fieldset key={w} className="space-y-2">
            <legend className="text-sm font-medium">{w === 0 ? t("thisWeekLabel") : t("nextWeekLabel")}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {days.map((day) => (
                <div key={day} className="flex items-center gap-2">
                  <Checkbox
                    id={`repeat-${day}`}
                    disabled={day === meal?.date}
                    checked={picked.includes(day)}
                    onCheckedChange={(on) =>
                      setPicked((list) => (on === true ? [...list, day] : list.filter((d) => d !== day)))
                    }
                  />
                  <Label htmlFor={`repeat-${day}`} className="font-normal capitalize">
                    {format.dateTime(asDate(day), { weekday: "short", day: "numeric" })}
                  </Label>
                </div>
              ))}
            </div>
          </fieldset>
        ))}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button disabled={picked.length === 0 || saving} onClick={save}>
            {saving ? <Spinner data-icon="inline-start" /> : null}
            {t("repeatConfirm", { count: picked.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
