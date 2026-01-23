import { useState, useEffect } from "react";
import axios from "axios";
import { format } from "date-fns";
import { 
  FileText, Search, Calendar, Car, Download, Eye, Filter, 
  ChevronLeft, ChevronRight, X, CheckCircle, XCircle, AlertCircle,
  User, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const WalkaroundCertificatesPage = () => {
  const [certificates, setCertificates] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedDriver, setSelectedDriver] = useState("");
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);
  
  // PDF Viewer
  const [viewingPdf, setViewingPdf] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchCertificates();
  }, [selectedVehicle, selectedDriver, dateFrom, dateTo]);

  const fetchData = async () => {
    try {
      const [vehiclesRes, driversRes] = await Promise.all([
        axios.get(`${API}/vehicles`).catch(() => ({ data: [] })),
        axios.get(`${API}/drivers`).catch(() => ({ data: [] }))
      ]);
      setVehicles(vehiclesRes.data || []);
      setDrivers(driversRes.data || []);
      await fetchCertificates();
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCertificates = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedVehicle) params.append("vehicle_id", selectedVehicle);
      if (selectedDriver) params.append("driver_id", selectedDriver);
      if (dateFrom) params.append("date_from", format(dateFrom, "yyyy-MM-dd"));
      if (dateTo) params.append("date_to", format(dateTo, "yyyy-MM-dd"));
      if (searchQuery) params.append("search", searchQuery);

      const response = await axios.get(`${API}/walkaround-checks?${params.toString()}`);
      setCertificates(response.data || []);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error fetching certificates:", error);
      toast.error("Failed to load certificates");
    }
  };

  const handleSearch = () => {
    fetchCertificates();
  };

  const handleViewPdf = async (certificate) => {
    setViewingPdf(certificate);
    setLoadingPdf(true);
    try {
      // Fetch PDF as blob
      const response = await axios.get(`${API}/walkaround-checks/${certificate.id}/pdf`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (error) {
      console.error("Error loading PDF:", error);
      toast.error("Failed to load PDF");
      setViewingPdf(null);
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleDownloadPdf = async (certificate) => {
    try {
      const response = await axios.get(`${API}/walkaround-checks/${certificate.id}/pdf`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${certificate.check_number || 'WO'}-${certificate.vehicle_reg || 'Unknown'}-${(certificate.submitted_at || '').slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error("Failed to download PDF");
    }
  };

  const closePdfViewer = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    setPdfUrl(null);
    setViewingPdf(null);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedVehicle("");
    setSelectedDriver("");
    setDateFrom(null);
    setDateTo(null);
  };

  const getStatusBadge = (status) => {
    if (status === "pass" || status === "passed") {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" /> Pass</Badge>;
    } else if (status === "fail" || status === "failed") {
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" /> Fail</Badge>;
    } else {
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><AlertCircle className="w-3 h-3 mr-1" /> {status || "Unknown"}</Badge>;
    }
  };

  // Filter certificates by search (local filter for immediate feedback)
  const filteredCertificates = certificates.filter(cert => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (cert.check_number || '').toLowerCase().includes(query) ||
      (cert.vehicle_reg || '').toLowerCase().includes(query) ||
      (cert.driver_name || '').toLowerCase().includes(query)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredCertificates.length / itemsPerPage);
  const paginatedCertificates = filteredCertificates.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const hasActiveFilters = selectedVehicle || selectedDriver || dateFrom || dateTo || searchQuery;

  return (
    <div className="space-y-6" data-testid="walkaround-certificates-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#D4A853]" />
            Walkaround Certificates
          </h1>
          <p className="text-gray-400 mt-1">View and manage vehicle inspection certificates</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-[#D4A853]">{filteredCertificates.length}</div>
          <div className="text-xs text-gray-400">Total Certificates</div>
        </div>
      </div>

      {/* Filters Card */}
      <Card className="bg-[#252525] border-[#3d3d3d]">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#D4A853]" />
            Filters
            {hasActiveFilters && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-gray-400 hover:text-white h-6 px-2"
                onClick={clearFilters}
              >
                <X className="w-3 h-3 mr-1" /> Clear All
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Certificate #, Vehicle, Driver..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-8 h-9 bg-[#1a1a1a] border-[#3d3d3d] text-white placeholder:text-gray-500"
                  data-testid="walkaround-search"
                />
              </div>
            </div>

            {/* Vehicle Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">Vehicle</Label>
              <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                <SelectTrigger className="h-9 bg-[#1a1a1a] border-[#3d3d3d] text-white">
                  <Car className="w-4 h-4 mr-2 text-gray-500" />
                  <SelectValue placeholder="All Vehicles" />
                </SelectTrigger>
                <SelectContent className="bg-[#252525] border-[#3d3d3d]">
                  <SelectItem value="" className="text-white">All Vehicles</SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="text-white">
                      {v.registration} - {v.make} {v.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Driver Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">Driver</Label>
              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger className="h-9 bg-[#1a1a1a] border-[#3d3d3d] text-white">
                  <User className="w-4 h-4 mr-2 text-gray-500" />
                  <SelectValue placeholder="All Drivers" />
                </SelectTrigger>
                <SelectContent className="bg-[#252525] border-[#3d3d3d]">
                  <SelectItem value="" className="text-white">All Drivers</SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id} className="text-white">
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date From */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">From Date</Label>
              <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-9 bg-[#1a1a1a] border-[#3d3d3d] hover:bg-[#2d2d2d]",
                      !dateFrom && "text-gray-500"
                    )}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    {dateFrom ? format(dateFrom, "dd MMM yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-[#252525] border-[#3d3d3d]">
                  <CalendarComponent
                    mode="single"
                    selected={dateFrom}
                    onSelect={(date) => { setDateFrom(date); setDateFromOpen(false); }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Date To */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">To Date</Label>
              <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-9 bg-[#1a1a1a] border-[#3d3d3d] hover:bg-[#2d2d2d]",
                      !dateTo && "text-gray-500"
                    )}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    {dateTo ? format(dateTo, "dd MMM yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-[#252525] border-[#3d3d3d]">
                  <CalendarComponent
                    mode="single"
                    selected={dateTo}
                    onSelect={(date) => { setDateTo(date); setDateToOpen(false); }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Certificates Table */}
      <Card className="bg-[#252525] border-[#3d3d3d]">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4A853]"></div>
              <span className="ml-3 text-gray-400">Loading certificates...</span>
            </div>
          ) : filteredCertificates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-gray-600 mb-3" />
              <p className="text-gray-400">No walkaround certificates found</p>
              {hasActiveFilters && (
                <Button variant="outline" className="mt-4" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#3d3d3d] hover:bg-transparent">
                    <TableHead className="text-gray-400">Certificate #</TableHead>
                    <TableHead className="text-gray-400">Date & Time</TableHead>
                    <TableHead className="text-gray-400">Vehicle</TableHead>
                    <TableHead className="text-gray-400">Driver</TableHead>
                    <TableHead className="text-gray-400">Type</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                    <TableHead className="text-gray-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCertificates.map((cert) => (
                    <TableRow key={cert.id} className="border-[#3d3d3d] hover:bg-[#2d2d2d]">
                      <TableCell className="font-medium text-white">
                        {cert.check_number || `WO-${cert.id?.slice(0, 6)}`}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-gray-500" />
                          {cert.submitted_at ? format(new Date(cert.submitted_at), "dd MMM yyyy, HH:mm") : "N/A"}
                        </div>
                      </TableCell>
                      <TableCell className="text-white">
                        <div className="flex items-center gap-1.5">
                          <Car className="w-3 h-3 text-[#D4A853]" />
                          {cert.vehicle_reg || "Unknown"}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-gray-500" />
                          {cert.driver_name || "Unknown"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs border-[#3d3d3d] text-gray-300">
                          {cert.check_type || "Standard"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(cert.overall_status || cert.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewPdf(cert)}
                            className="h-8 px-2 text-gray-400 hover:text-white hover:bg-[#3d3d3d]"
                            data-testid={`view-pdf-${cert.id}`}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadPdf(cert)}
                            className="h-8 px-2 text-gray-400 hover:text-white hover:bg-[#3d3d3d]"
                            data-testid={`download-pdf-${cert.id}`}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#3d3d3d]">
                  <div className="text-sm text-gray-400">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredCertificates.length)} of {filteredCertificates.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-8 px-2 bg-[#1a1a1a] border-[#3d3d3d]"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-gray-400">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 px-2 bg-[#1a1a1a] border-[#3d3d3d]"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* PDF Viewer Dialog */}
      <Dialog open={!!viewingPdf} onOpenChange={closePdfViewer}>
        <DialogContent className="max-w-5xl h-[90vh] bg-[#1a1a1a] border-[#3d3d3d] p-0">
          <DialogHeader className="px-4 py-3 border-b border-[#3d3d3d]">
            <DialogTitle className="text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#D4A853]" />
                {viewingPdf?.check_number || "Certificate"} - {viewingPdf?.vehicle_reg || "Vehicle"}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => viewingPdf && handleDownloadPdf(viewingPdf)}
                className="mr-8 bg-[#252525] border-[#3d3d3d] hover:bg-[#3d3d3d]"
              >
                <Download className="w-4 h-4 mr-1" />
                Download PDF
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-[#0a0a0a]">
            {loadingPdf ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4A853]"></div>
                <span className="ml-3 text-gray-400">Loading PDF...</span>
              </div>
            ) : pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="w-full h-full"
                title="PDF Viewer"
                style={{ minHeight: "calc(90vh - 60px)" }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                Failed to load PDF
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WalkaroundCertificatesPage;
