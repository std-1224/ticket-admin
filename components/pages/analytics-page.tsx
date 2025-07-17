"use client"

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
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

const salesData = [
  { date: "Oct 1", sales: 22 },
  { date: "Oct 2", sales: 45 },
  { date: "Oct 3", sales: 78 },
  { date: "Oct 4", sales: 60 },
  { date: "Oct 5", sales: 110 },
  { date: "Oct 6", sales: 95 },
  { date: "Oct 7", sales: 150 },
]

const analyticsData = {
  salesPerDay: salesData,
  ticketTypes: [
    { name: "General Admission", value: 3500, fill: "var(--color-ga)" },
    { name: "VIP", value: 1292, fill: "var(--color-vip)" },
    { name: "Early Bird", value: 100, fill: "var(--color-early)" },
  ],
  conversionRate: 93.5,
  peakHours: "6 PM - 8 PM",
}

export const AnalyticsPage = () => {
  const chartConfig = {
    "General Admission": { label: "General Admission", color: "hsl(var(--color-ga))" },
    VIP: { label: "VIP", color: "hsl(var(--color-vip))" },
    "Early Bird": { label: "Early Bird", color: "hsl(var(--color-early))" },
  }

  return (
    <div className="space-y-3 sm:space-y-6 lg:space-y-8 pb-20 md:pb-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base">Conversion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-3xl lg:text-4xl font-bold">{analyticsData.conversionRate}%</div>
            <p className="text-xs text-muted-foreground">Registered users vs. buyers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base">Peak Purchase Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-3xl lg:text-4xl font-bold">{analyticsData.peakHours}</div>
            <p className="text-xs text-muted-foreground">Highest traffic period</p>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base">Most Popular Ticket</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-3xl lg:text-4xl font-bold">General Admission</div>
            <p className="text-xs text-muted-foreground">Most popular ticket category</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg sm:text-xl">Ticket Sales by Type</CardTitle>
          </CardHeader>
          <CardContent className="h-48 sm:h-80">
            <ChartContainer config={chartConfig}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                  <Pie data={analyticsData.ticketTypes} dataKey="value" nameKey="name" innerRadius={40} strokeWidth={5}>
                    {analyticsData.ticketTypes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent nameKey="name" payload={analyticsData.ticketTypes} />} />
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
              <BarChart data={analyticsData.salesPerDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    borderColor: "hsl(var(--border))",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
