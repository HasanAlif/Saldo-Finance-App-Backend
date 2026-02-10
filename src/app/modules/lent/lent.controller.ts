import httpStatus from "http-status";
import sendResponse from "../../../shared/sendResponse";
import catchAsync from "../../../shared/catchAsync";
import { lentService } from "./lent.service";
import { Request, Response } from "express";

const createLent = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const result = await lentService.createLent(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Lent record created successfully",
    data: result,
  });
});

const getAllLent = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const result = await lentService.getAllLent(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Lent records retrieved successfully",
    data: result,
  });
});

const getLentById = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  const result = await lentService.getLentById(userId, id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Lent record retrieved successfully",
    data: result,
  });
});

const updateLent = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  const result = await lentService.updateLent(userId, id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Lent record updated successfully",
    data: result,
  });
});

const deleteLent = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  await lentService.deleteLent(userId, id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Lent record deleted successfully",
    data: null,
  });
});

const addPayment = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  const { amount } = req.body;
  const result = await lentService.addPayment(userId, id, amount);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment collected successfully",
    data: result,
  });
});

const markAsPaid = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  const result = await lentService.markAsPaid(userId, id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Lent amount marked as fully collected",
    data: result,
  });
});

export const lentController = {
  createLent,
  getAllLent,
  getLentById,
  updateLent,
  deleteLent,
  addPayment,
  markAsPaid,
};
