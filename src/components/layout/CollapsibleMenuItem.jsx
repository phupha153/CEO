import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { ChevronDown } from "lucide-react";

export default function CollapsibleMenuItem({ item }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const hasActiveSubItem = item.subItems?.some(
    (sub) => location.pathname === sub.url.split("?")[0]
  );

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => setIsOpen(!isOpen)}
        className="group hover:bg-gradient-to-r hover:from-blue-50/80 hover:to-purple-50/80 transition-all duration-200 rounded-2xl mb-1 cursor-pointer group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:pl-2"
        title={item.title}
      >
        <item.icon className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
        <span className="font-medium group-data-[collapsible=icon]:hidden truncate">
          {item.title}
        </span>
        <ChevronDown
          className={`w-4 h-4 ml-auto transition-transform group-data-[collapsible=icon]:hidden ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </SidebarMenuButton>
      {isOpen && (
        <SidebarMenuSub>
          {item.subItems.map((subItem) => {
            const isSubActive = location.pathname === subItem.url.split("?")[0];
            return (
              <SidebarMenuSubItem key={subItem.title}>
                <SidebarMenuSubButton
                  onClick={() => navigate(subItem.url)}
                  className={`cursor-pointer ${
                    isSubActive
                      ? "bg-blue-100 text-blue-700 font-medium"
                      : ""
                  }`}
                >
                  <subItem.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{subItem.title}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}