import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  CheckCircle2,
  XCircle,
  ThermometerSun,
  Package,
  Loader2
} from "lucide-react";
import type { DriverAvailability } from "@shared/schema";

interface DayInfo {
  date: Date;
  dateString: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  availability?: DriverAvailability;
}

export default function AvailabilityPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [selectedDay, setSelectedDay] = useState<DayInfo | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    status: "" as "available" | "unavailable" | "",
    notes: "",
    thermalBlanket: false,
    thermalBag: false,
    otherPackaging: false,
  });

  const startDate = useMemo(() => {
    const start = new Date(currentMonth);
    start.setDate(1);
    return start.toISOString().split("T")[0];
  }, [currentMonth]);

  const endDate = useMemo(() => {
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    return end.toISOString().split("T")[0];
  }, [currentMonth]);

  const { data: availability, isLoading: availabilityLoading } = useQuery<DriverAvailability[]>({
    queryKey: ["/api/availability", startDate, endDate],
    queryFn: async () => {
      const response = await fetch(`/api/availability?startDate=${startDate}&endDate=${endDate}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch availability");
      return response.json();
    },
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { date: string }) => {
      return apiRequest("POST", "/api/availability", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/availability"] });
      toast({
        title: "Availability Updated",
        description: "Your availability has been saved.",
      });
      setDialogOpen(false);
      setSelectedDay(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save availability",
        variant: "destructive",
      });
    },
  });

  const days = useMemo(() => {
    const result: DayInfo[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDay = new Date(currentMonth);
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    
    const startPadding = firstDay.getDay();
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0);
    
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(prevMonth);
      date.setDate(prevMonth.getDate() - i);
      const dateString = date.toISOString().split("T")[0];
      result.push({
        date,
        dateString,
        isCurrentMonth: false,
        isToday: false,
        isPast: date < today,
        availability: availability?.find(a => a.date === dateString),
      });
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
      const dateString = date.toISOString().split("T")[0];
      result.push({
        date,
        dateString,
        isCurrentMonth: true,
        isToday: date.getTime() === today.getTime(),
        isPast: date < today,
        availability: availability?.find(a => a.date === dateString),
      });
    }

    const endPadding = 42 - result.length;
    for (let i = 1; i <= endPadding; i++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, i);
      const dateString = date.toISOString().split("T")[0];
      result.push({
        date,
        dateString,
        isCurrentMonth: false,
        isToday: false,
        isPast: date < today,
        availability: availability?.find(a => a.date === dateString),
      });
    }

    return result;
  }, [currentMonth, availability]);

  const handleDayClick = (day: DayInfo) => {
    if (day.isPast) return;
    
    setSelectedDay(day);
    setFormData({
      status: (day.availability?.status as "available" | "unavailable") || "",
      notes: day.availability?.notes || "",
      thermalBlanket: day.availability?.thermalBlanket || false,
      thermalBag: day.availability?.thermalBag || false,
      otherPackaging: day.availability?.otherPackaging || false,
    });
    setDialogOpen(true);
  };

  const handleSave = (status: "available" | "unavailable") => {
    if (!selectedDay) return;
    saveMutation.mutate({
      date: selectedDay.dateString,
      status,
      notes: formData.notes,
      thermalBlanket: formData.thermalBlanket,
      thermalBag: formData.thermalBag,
      otherPackaging: formData.otherPackaging,
    });
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const monthYear = currentMonth.toLocaleDateString("en-CA", { 
    month: "long", 
    year: "numeric" 
  });

  const isLoading = authLoading || availabilityLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <p className="font-medium">My Availability</p>
            <p className="text-xs text-muted-foreground">Manage your route availability</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={prevMonth} data-testid="button-prev-month">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <CardTitle className="text-lg" data-testid="text-current-month">{monthYear}</CardTitle>
              <Button variant="ghost" size="icon" onClick={nextMonth} data-testid="button-next-month">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            <CardDescription className="text-center">Tap a date to set your availability</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => (
                <button
                  key={index}
                  onClick={() => handleDayClick(day)}
                  disabled={day.isPast}
                  className={`
                    aspect-square flex flex-col items-center justify-center rounded-md text-sm relative
                    ${day.isCurrentMonth ? "text-foreground" : "text-muted-foreground/50"}
                    ${day.isToday ? "ring-2 ring-primary" : ""}
                    ${day.isPast ? "opacity-40 cursor-not-allowed" : "hover-elevate cursor-pointer"}
                    ${day.availability?.status === "available" ? "bg-green-500/20" : ""}
                    ${day.availability?.status === "unavailable" ? "bg-red-500/20" : ""}
                  `}
                  data-testid={`day-${day.dateString}`}
                >
                  <span>{day.date.getDate()}</span>
                  {day.availability && (
                    <div className="absolute bottom-1">
                      {day.availability.status === "available" ? (
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-600" />
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-3 w-3 text-green-600" />
            </div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500/20 flex items-center justify-center">
              <XCircle className="h-3 w-3 text-red-600" />
            </div>
            <span>Unavailable</span>
          </div>
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Set Availability
            </DialogTitle>
            <DialogDescription>
              {selectedDay?.date.toLocaleDateString("en-CA", { 
                weekday: "long",
                month: "long", 
                day: "numeric",
                year: "numeric"
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package className="h-4 w-4" />
                <span className="font-medium">Packaging Equipment</span>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="dialog-thermal-blanket"
                    checked={formData.thermalBlanket}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, thermalBlanket: checked === true }))
                    }
                    data-testid="dialog-checkbox-thermal-blanket"
                  />
                  <Label htmlFor="dialog-thermal-blanket" className="flex items-center gap-2">
                    <ThermometerSun className="h-4 w-4 text-orange-500" />
                    Thermal Blanket
                  </Label>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="dialog-thermal-bag"
                    checked={formData.thermalBag}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, thermalBag: checked === true }))
                    }
                    data-testid="dialog-checkbox-thermal-bag"
                  />
                  <Label htmlFor="dialog-thermal-bag" className="flex items-center gap-2">
                    <ThermometerSun className="h-4 w-4 text-blue-500" />
                    Thermal Bag
                  </Label>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="dialog-other-packaging"
                    checked={formData.otherPackaging}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, otherPackaging: checked === true }))
                    }
                    data-testid="dialog-checkbox-other-packaging"
                  />
                  <Label htmlFor="dialog-other-packaging" className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-gray-500" />
                    Other Packaging
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dialog-notes">Notes (optional)</Label>
              <Textarea
                id="dialog-notes"
                placeholder="Any additional information..."
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="resize-none"
                rows={2}
                data-testid="dialog-textarea-notes"
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => handleSave("unavailable")}
                disabled={saveMutation.isPending}
                data-testid="dialog-button-unavailable"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Not Available
                  </>
                )}
              </Button>
              <Button
                className="flex-1"
                onClick={() => handleSave("available")}
                disabled={saveMutation.isPending}
                data-testid="dialog-button-available"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Available
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
