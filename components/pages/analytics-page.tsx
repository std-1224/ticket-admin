"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartTooltip,
} from "@/components/ui/chart";
import { useAuth } from "@/contexts/auth-context";
import { useEffect, useState } from "react";

// const analyticsData = {
//   salesPerDay: salesData,
//   ticketTypes: [
//     { name: "General Admission", value: 3500, fill: "var(--color-ga)" },
//     { name: "VIP", value: 1292, fill: "var(--color-vip)" },
//     { name: "Early Bird", value: 100, fill: "var(--color-early)" },
//   ],
//   conversionRate: 93.5,
//   peakHours: "6 PM - 8 PM",
// };

interface SalesDataPoint {
  date: string;
  fullDate: string;
  sales: number;
  revenue: number;
}

interface TicketTypeData {
  name: string;
  value: number;
  revenue: number;
  fill: string;
}

export const AnalyticsPage = () => {
  const { handleAuthError } = useAuth();
  const [salesData, setSalesData] = useState<SalesDataPoint[]>([]);
  const [ticketTypesData, setTicketTypesData] = useState<TicketTypeData[]>([]);
  const [mostPopularTicket, setMostPopularTicket] = useState<string>("General Admission");

  const fetchAllData = async () => {
    await Promise.all([fetchSalesData(), fetchTicketTypesData()]);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchSalesData = async () => {
    try {
      const response = await fetch("/api/analytics/daily-sales?days=30");
      const result = await response.json();

      if (!response.ok) {
        // Check if it's an auth error
        if (response.status === 401 || result.code === "AUTH_ERROR") {
          handleAuthError({ message: result.error, status: response.status });
          return;
        }
        throw new Error(result.error || "Failed to fetch sales data");
      }

      if (result.success) {
        setSalesData(result.data || []);
      } else {
        throw new Error(result.error || "Failed to fetch sales data");
      }
    } catch (err: any) {
      console.error("Error fetching sales data:", err);
      // Don't set error state for sales data, just log it
      // The chart will show empty if sales data fails
    }
  };

  const fetchTicketTypesData = async () => {
    try {
      const response = await fetch("/api/analytics/ticket-types");
      const result = await response.json();

      if (!response.ok) {
        // Check if it's an auth error
        if (response.status === 401 || result.code === "AUTH_ERROR") {
          handleAuthError({ message: result.error, status: response.status });
          return;
        }
        throw new Error(result.error || "Failed to fetch ticket types data");
      }

      if (result.success) {
        setTicketTypesData(result.data || []);
        // Set the most popular ticket (first in sorted array)
        if (result.data && result.data.length > 0) {
          setMostPopularTicket(result.data[0].name);
        }
      } else {
        throw new Error(result.error || "Failed to fetch ticket types data");
      }
    } catch (err: any) {
      console.error("Error fetching ticket types data:", err);
      // Don't set error state, just log it
      // The chart will show empty if ticket types data fails
    }
  };
  const chartConfig = {
    "General Admission": {
      label: "General Admission",
      color: "hsl(var(--color-ga))",
    },
    VIP: { label: "VIP", color: "hsl(var(--color-vip))" },
    "Early Bird": { label: "Early Bird", color: "hsl(var(--color-early))" },
  };

  return (
    <div className="space-y-3 sm:space-y-6 lg:space-y-8 pb-20 md:pb-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base">
              Conversion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-3xl lg:text-4xl font-bold">
             93.5
            </div>
            <p className="text-xs text-muted-foreground">
              Registered users vs. buyers
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base">
              Peak Purchase Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-3xl lg:text-4xl font-bold">
              6 PM - 8 PM
            </div>
            <p className="text-xs text-muted-foreground">
              Highest traffic period
            </p>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base">
              Most Popular Ticket
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-3xl lg:text-4xl font-bold">
              {mostPopularTicket}
            </div>
            <p className="text-xs text-muted-foreground">
              Most popular ticket category
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg sm:text-xl">
              Ticket Sales by Type
            </CardTitle>
          </CardHeader>
          <CardContent className="h-48 sm:h-80">
            <ChartContainer config={chartConfig}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <ChartTooltip
                    cursor={false}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: payload[0].color }}
                              />
                              <span className="font-medium">{data.name}</span>
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              <div>Tickets: {data.value}</div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Pie
                    data={ticketTypesData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={40}
                    strokeWidth={5}
                  >
                    {ticketTypesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartLegend
                    content={({ payload }) => (
                      <div className="flex flex-wrap justify-center gap-4 mt-4">
                        {payload?.map((entry, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-sm font-medium text-foreground">
                              {entry.value}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({ticketTypesData.find(t => t.name === entry.value)?.value || 0} tickets)
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg sm:text-xl">Sales by Day</CardTitle>
          </CardHeader>
          <CardContent className="h-48 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    borderColor: "hsl(var(--border))",
                    fontSize: "12px",
                  }}
                />
                <Bar
                  dataKey="sales"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
