import api from '@/lib/api';
export const complaintService={
 list:async(params:any={})=>(await api.get('/complaints',{params})).data,
 summary:async()=>(await api.get('/complaints/summary')).data?.data,
 report:async(params:any={})=>(await api.get('/complaints/report',{params})).data?.data,
 options:async()=>(await api.get('/complaints/options')).data?.data,
 one:async(id:number)=>(await api.get(`/complaints/${id}`)).data?.data,
 create:async(payload:any)=>(await api.post('/complaints',payload)).data,
 update:async(id:number,payload:any)=>(await api.put(`/complaints/${id}`,payload)).data,
 status:async(id:number,payload:any)=>(await api.post(`/complaints/${id}/status`,payload)).data,
 note:async(id:number,note:string)=>(await api.post(`/complaints/${id}/notes`,{note})).data,
};
