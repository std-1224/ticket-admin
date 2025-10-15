"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

interface CheckInStats {
  totalCheckedIn: number
  pendingCheckIn: number
  totalOrders: number
}

interface LiveCheckIn {
  id: string
  attendeeName: string
  status: string
  scannedAt: string
  formattedTime: string
}

export const CheckInPage = () => {
  const [checkInStats, setCheckInStats] = useState<CheckInStats>({
    totalCheckedIn: 0,
    pendingCheckIn: 0,
    totalOrders: 0
  })
  const [liveCheckIns, setLiveCheckIns] = useState<LiveCheckIn[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCheckInStats = async () => {
      try {
        // Get orders with delivered status (checked in)
        const { data: deliveredOrders, error: deliveredError } = await supabase
          .from('event_orders')
          .select('id')
          .eq('status', 'delivered')

        if (deliveredError) {
          console.error('Error fetching delivered orders:', deliveredError)
          return
        }

        // Get orders with pending status (pending check-in)
        const { data: pendingOrders, error: pendingError } = await supabase
          .from('event_orders')
          .select('id')
          .eq('status', 'pending')

        if (pendingError) {
          console.error('Error fetching pending orders:', pendingError)
          return
        }

        // Get total orders (delivered + pending + paid)
        const { data: allOrders, error: allError } = await supabase
          .from('event_orders')
          .select('id')
          .in('status', ['delivered', 'pending', 'paid'])

        if (allError) {
          console.error('Error fetching all orders:', allError)
          return
        }

        const totalCheckedIn = deliveredOrders?.length || 0
        const pendingCheckIn = pendingOrders?.length || 0
        const totalOrders = allOrders?.length || 0

        setCheckInStats({
          totalCheckedIn,
          pendingCheckIn,
          totalOrders
        })
      } catch (error) {
        console.error('Error fetching check-in stats:', error)
      }
    }

    const fetchLiveCheckIns = async () => {
      try {
        // Fetch recent scans with user information
        const { data: scans, error: scansError } = await supabase
          .from('event_scans')
          .select(`
            id,
            scanned_at,
            status,
            scanned_by
          `)
          .order('scanned_at', { ascending: false })
          .limit(10)

        if (scansError) {
          console.error('Error fetching live check-ins:', scansError)
          return
        }

        // Get unique user IDs from scans
        const userIds = [...new Set((scans || []).map((scan: any) => scan.scanned_by).filter(Boolean))]

        // Fetch user data separately
        let usersData: any[] = []
        if (userIds.length > 0) {
          const { data: users, error: usersError } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', userIds)

          if (usersError) {
            console.error('Error fetching users for check-ins:', usersError)
          } else {
            usersData = users || []
          }
        }

        // Create a map for quick user lookup
        const usersMap = new Map(usersData.map(user => [user.id, user]))

        // Transform the data
        const liveCheckInData: LiveCheckIn[] = (scans || []).map((scan: any) => {
          const user = usersMap.get(scan.scanned_by)
          const scannedAt = new Date(scan.scanned_at)

          return {
            id: scan.id,
            attendeeName: user?.name || 'Unknown User',
            status: scan.status,
            scannedAt: scan.scanned_at,
            formattedTime: scannedAt.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              second: '2-digit',
              hour12: true
            })
          }
        })

        setLiveCheckIns(liveCheckInData)
      } catch (error) {
        console.error('Error fetching live check-ins:', error)
      } finally {
        setLoading(false)
      }
    }

    const fetchData = async () => {
      await Promise.all([fetchCheckInStats(), fetchLiveCheckIns()])
    }

    fetchData()
  }, [])

  const checkInPercentage = checkInStats.totalOrders > 0
    ? Math.round((checkInStats.totalCheckedIn / checkInStats.totalOrders) * 100)
    : 0

  if (loading) {
    return (
      <div className="space-y-3 sm:space-y-6 pb-20 md:pb-0">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading check-in data...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-6 pb-20 md:pb-0">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg sm:text-xl">Check-in Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {checkInStats.totalCheckedIn} of {checkInStats.totalOrders} attendees checked in
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
            <div className="text-lg sm:text-3xl font-bold">{checkInStats.totalCheckedIn}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm sm:text-base">Pending Check-in</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-3xl font-bold">{checkInStats.pendingCheckIn}</div>
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
                {liveCheckIns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No recent check-ins
                    </TableCell>
                  </TableRow>
                ) : (
                  liveCheckIns.map((checkin) => (
                    <TableRow key={checkin.id}>
                      <TableCell className="font-medium text-xs sm:text-sm">{checkin.attendeeName}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            checkin.status === "valid" ? "default" :
                            checkin.status === "used" ? "secondary" :
                            "destructive"
                          }
                          className="text-xs"
                        >
                          {checkin.status === "valid" ? "Success" :
                           checkin.status === "used" ? "Already Used" :
                           checkin.status === "invalid" ? "Invalid" :
                           checkin.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">{checkin.formattedTime}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-xs">
                          Manual Check-in
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
