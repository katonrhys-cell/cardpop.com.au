import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const EventFilters = ({ typeFilter, setTypeFilter, monthFilter, setMonthFilter, search, setSearch }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 md:p-6 mb-10 shadow-sm flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
      
      <div className="w-full lg:w-80 relative shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Search events or locations..." 
          className="pl-9 h-11 bg-background border-border"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:gap-8 w-full lg:w-auto">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Type</span>
          <Tabs value={typeFilter} onValueChange={setTypeFilter}>
            <TabsList className="bg-muted">
              <TabsTrigger value="All" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">All</TabsTrigger>
              <TabsTrigger value="Trade Show" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Trade Shows</TabsTrigger>
              <TabsTrigger value="Exhibit" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Exhibits</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Month</span>
          <Tabs value={monthFilter} onValueChange={setMonthFilter}>
            <TabsList className="bg-muted">
              <TabsTrigger value="All" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">All</TabsTrigger>
              <TabsTrigger value="May" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">May</TabsTrigger>
              <TabsTrigger value="June" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">June</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

    </div>
  );
};

export default EventFilters;