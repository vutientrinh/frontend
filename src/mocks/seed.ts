import { faker } from '@faker-js/faker'
import type { Customer, Order, OutboxEvent, Payment, PaymentHistory, Product } from '../api/types'
export interface DemoDB { customers: Customer[]; products: Product[]; orders: Order[]; payments: Payment[]; events: OutboxEvent[]; history: Record<string, PaymentHistory[]> }
export function seed(): DemoDB {
 faker.seed(12005)
 const names = ['Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Vo', 'Phan', 'Do']
 const customers = Array.from({length:40}, (_,i) => ({ id:`c${i+1}`, firstName:i%2 ? faker.person.firstName() : ['Linh','Minh','An','Lan','Huy','Mai'][i%6], lastName:i%2 ? faker.person.lastName() : names[i%names.length], email:`customer${i+1}@example.com`, phoneNumber:`090${String(i+1).padStart(7,'0')}` }))
 const products = Array.from({length:25}, (_,i) => ({ id:`p${i+1}`, productName:`${faker.commerce.productAdjective()} ${faker.commerce.product()}`, productDescription:faker.commerce.productDescription(), unitPrice:String((i+1)*25000), active:true }))
 const orders: Order[] = Array.from({length:90}, (_,i) => { const customer=customers[i%customers.length], product=products[i%products.length]; const createdAt=new Date(Date.now()-(i*16+1)*3600000).toISOString(); const paid=i%5!==0; return {id:`o${i+1}`,orderCode:`ORD-${String(i+1).padStart(4,'0')}`,status:paid?'PAID':'PENDING',orderAmount:product.unitPrice,customerId:customer.id,customerName:`${customer.firstName} ${customer.lastName}`,items:[{productId:product.id,quantity:1,price:product.unitPrice}],createdAt} })
 const payments: Payment[] = orders.filter(o=>o.status==='PAID').map((o,i)=>({id:`pay${i+1}`,orderId:o.id,status:'COMPLETED',method:['CARD','BANK_TRANSFER','EWALLET'][i%3],amount:o.orderAmount,currency:'VND',createdAt:o.createdAt,updatedAt:o.createdAt}))
 const history=Object.fromEntries(payments.map(p=>[p.id,[{status:'PENDING',changedAt:p.createdAt,source:'SYSTEM' as const},{status:'COMPLETED',changedAt:p.updatedAt,source:'SYSTEM' as const}]]))
 const events: OutboxEvent[]=Array.from({length:150},(_,i)=>({id:`evt${i+1}`,eventType:'payment.requested.v1',aggregateType:'PAYMENT',aggregateId:payments[i%payments.length].id,status:i%20===0?'FAILED':'PUBLISHED',attempts:i%20===0?3:1,nextRetryAt:null,lastError:i%20===0?'Delivery failed':null,createdAt:payments[i%payments.length].createdAt,publishedAt:i%20===0?null:payments[i%payments.length].updatedAt}))
 return {customers,products,orders,payments,events,history}
}
