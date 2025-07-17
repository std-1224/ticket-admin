"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

const overviewStats = {
  ticketsSold: 4892,
  registeredUsers: 5230,
  checkIns: 1204,
  revenue: 73380,
}

const checkInData = [
  { name: "Noah Martinez", status: "Success", timestamp: "7:05:12 PM" },
  { name: "Guest User", status: "Invalid", timestamp: "7:04:58 PM" },
  { name: "Olivia Martin", status: "Success", timestamp: "7:02:34 PM" },
]

export const CheckInPage = () => {
  const checkInPercentage = Math.round((overviewStats.checkIns / overviewStats.ticketsSold) * 100)
  const pendingCheckIn = overviewStats.ticketsSold - overviewStats.checkIns

  return (
    <div className="space-y-3 sm:space-y-6 pb-20 md:pb-0">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg sm:text-xl">Check-in Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {overviewStats.checkIns} of {overviewStats.ticketsSold} attendees checked in
            </span>
            <span className="font-bold text-primary text-lg">{checkInPercentage}%</span>
          </div>
          <Progress value={checkInPercentage} className="h-2" />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm sm:text-base">Total Checked In</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-3xl font-bold">{overviewStats.checkIns}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm sm:text-base">Pending Check-in</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-3xl font-bold">{pendingCheckIn}</div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg sm:text-xl">Live Check-in</CardTitle>
          <CardDescription className="text-sm">Real-time feed of attendee check-ins.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px] text-xs sm:text-sm">Attendee Name</TableHead>
                  <TableHead className="min-w-[80px] text-xs sm:text-sm">Status</TableHead>
                  <TableHead className="min-w-[80px] text-xs sm:text-sm">Time</TableHead>
                  <TableHead className="text-right min-w-[100px] text-xs sm:text-sm">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkInData.map((checkin, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium text-xs sm:text-sm">{checkin.name}</TableCell>
                    <TableCell>
                      <Badge variant={checkin.status === "Success" ? "default" : "destructive"} className="text-xs">
                        {checkin.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm">{checkin.timestamp}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-xs">
                        Manual Check-in
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
