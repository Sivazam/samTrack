"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { addDays, format } from "date-fns"
import { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface DatePickerProps {
  date?: Date
  onSelect?: (date: Date | undefined) => void
  className?: string
  disabledDate?: (date: Date) => boolean
}

export function DatePicker({
  date,
  onSelect,
  className,
  disabledDate
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Use the date for the current view when there's no date selected
  // but avoid resetting the month view every time parent state updates if possible.
  // DayPicker's defaultMonth only runs on mount. 
  // For better stability, we can control the month view.
  const [month, setMonth] = React.useState<Date | undefined>(date || new Date())

  // Sync month view when popover opens to focus on the selected date
  React.useEffect(() => {
    if (open && date) {
      setMonth(date)
    }
  }, [open, date])

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            type="button"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 z-[60]"
          align="start"
          side="bottom"
          // Avoid closing when interacting with the portalled content on iOS
          onInteractOutside={(e) => {
            // If it's a touch event on iOS, we want to be careful about auto-closing
            if (e.detail.originalEvent.type === 'focusout') {
              e.preventDefault();
            }
          }}
        >
          <Calendar
            mode="single"
            required
            selected={date}
            onSelect={(d) => {
              if (d) {
                onSelect?.(d)
                setOpen(false)
              }
            }}
            disabled={disabledDate || ((date) => date > new Date() || date < new Date("1900-01-01"))}
            initialFocus={false}
            captionLayout="dropdown"
            fromYear={new Date().getFullYear() - 100}
            toYear={new Date().getFullYear() + 20}
            month={month}
            onMonthChange={setMonth}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}