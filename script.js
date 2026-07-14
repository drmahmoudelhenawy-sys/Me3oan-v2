const fs = require('fs');
const path = require('path');
const filePath = 'E:/MyApps/Me3oan-v2/Me3oan-v2-main/components/ChatSystem.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/?????? ????????/g, "???? ?????????");
content = content.replace(/bg-\[#17212B\]/g, "bg-white dark:bg-[#17212B]");
content = content.replace(/text-white/g, "text-gray-800 dark:text-white");
content = content.replace(/bg-\[#232E3C\]/g, "bg-gray-50 dark:bg-[#232E3C]");
content = content.replace(/border-white\\/5/g, "border-gray-200 dark:border-white/5");
content = content.replace(/bg-white\\/10/g, "bg-gray-200 dark:bg-white/10");
content = content.replace(/bg-white\\/5/g, "bg-gray-100 dark:bg-white/5");
content = content.replace(/hover:bg-white\\/10/g, "hover:bg-gray-200 dark:hover:bg-white/10");
content = content.replace(/hover:bg-white\\/5/g, "hover:bg-gray-100 dark:hover:bg-white/5");
content = content.replace(/text-gray-200/g, "text-gray-700 dark:text-gray-200");
content = content.replace(/text-gray-300/g, "text-gray-600 dark:text-gray-300");
content = content.replace(/bg-\[#2B5278\]\\/50/g, "bg-blue-50 dark:bg-[#2B5278]/50");
content = content.replace(/bg-\[#2B5278\]\\/60/g, "bg-blue-50 dark:bg-[#2B5278]/60");
content = content.replace(/bg-\[#2B5278\]\\/40/g, "bg-blue-50 dark:bg-[#2B5278]/40");
content = content.replace(/bg-\[#2B5278\]/g, "bg-blue-600 dark:bg-[#2B5278]");

// Specifically fix activeTab white text override
content = content.replace(/'bg-blue-600 text-white' : 'bg-gray-50 dark:bg-\[#232E3C\]/g, "'bg-blue-600 text-white dark:text-white' : 'bg-gray-50 dark:bg-[#232E3C]");

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done!');
